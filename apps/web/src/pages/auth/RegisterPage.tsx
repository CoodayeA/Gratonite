import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

/* ── Inline style objects (design tokens via CSS variables) ────────── */

const styles = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: 24,
  } as React.CSSProperties,

  card: {
    width: 550,
    maxWidth: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 44,
    paddingRight: 44,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } as React.CSSProperties,

  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  heading: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  subheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: '4px 0 0',
  } as React.CSSProperties,

  fieldsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  } as React.CSSProperties,

  termsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  } as React.CSSProperties,

  checkbox: (checked: boolean) =>
    ({
      width: 18,
      height: 18,
      minWidth: 18,
      borderRadius: 4,
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--stroke)'}`,
      background: checked ? 'var(--accent)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      marginTop: 1,
      transition: 'all 0.15s ease',
    }) as React.CSSProperties,

  termsText: {
    fontSize: 12,
    color: 'var(--text-faint)',
    lineHeight: 1.5,
    userSelect: 'none' as const,
  } as React.CSSProperties,

  termsLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
  } as React.CSSProperties,

  submitButton: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  signInRow: {
    textAlign: 'center' as const,
    fontSize: 14,
  } as React.CSSProperties,

  signInText: {
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  signInLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
    marginLeft: 4,
  } as React.CSSProperties,

  error: {
    background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--danger)',
    lineHeight: 1.5,
  } as React.CSSProperties,

  oauthButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 6,
    border: '1px solid var(--stroke)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
} as const;

/* ── Component ─────────────────────────────────────────────────────── */

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Username availability
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  // Errors & loading
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const usernameTimer = useRef<ReturnType<typeof setTimeout>>();

  // Live username availability check
  useEffect(() => {
    setUsernameAvailable(null);
    if (username.length < 2) return;

    clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await api.auth.checkUsername(username);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(usernameTimer.current);
  }, [username]);

  function getUsernameHint(): string {
    if (usernameChecking) return 'Checking...';
    if (usernameAvailable === true) return 'Username is available!';
    if (usernameAvailable === false) return 'Username is taken.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Terms validation
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    if (usernameAvailable === false) {
      setError('Please choose a different username.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.register({
        email,
        username,
        password,
      } as Parameters<typeof api.auth.register>[0]);

      setAccessToken(res.accessToken);

      // Fetch full profile
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
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setFieldErrors(err.details);
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit} noValidate>
        {/* Logo */}
        <div style={styles.logo} aria-hidden="true">G</div>

        {/* Heading */}
        <div>
          <h2 style={styles.heading}>Create Account</h2>
          <p style={styles.subheading}>Join the Gratonite community</p>
        </div>

        {/* Error banner */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Fields */}
        <div style={styles.fieldsGroup}>
          {/* Username */}
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
            }
            hint={getUsernameHint()}
            error={
              usernameAvailable === false
                ? 'Username is already taken'
                : fieldErrors['username']?.[0]
            }
            required
            autoComplete="username"
            autoFocus
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors['email']?.[0]}
            required
            autoComplete="email"
          />

          {/* Password */}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={
              password.length > 0 && password.length < 8
                ? 'Must be at least 8 characters'
                : ''
            }
            error={fieldErrors['password']?.[0]}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {/* Terms checkbox */}
        <label style={styles.termsRow}>
          <div
            style={styles.checkbox(termsAccepted)}
            role="checkbox"
            aria-checked={termsAccepted}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setTermsAccepted(!termsAccepted);
              }
            }}
          >
            {termsAccepted && (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path
                  d="M1 5L4.5 8.5L11 1.5"
                  stroke="var(--text-on-gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            tabIndex={-1}
          />
          <span style={styles.termsText}>
            I agree to the{' '}
            <a href="/terms" style={styles.termsLink} onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" style={styles.termsLink} onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </a>
          </span>
        </label>

        {/* Create Account button */}
        <Button
          type="submit"
          loading={loading}
          className="auth-submit"
          style={styles.submitButton}
        >
          Create Account
        </Button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' } as React.CSSProperties}>
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
        </div>

        {/* OAuth buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/google`; }}
            style={styles.oauthButton}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/apple`; }}
            style={styles.oauthButton}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/facebook`; }}
            style={styles.oauthButton}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
        </div>

        {/* Sign in link */}
        <div style={styles.signInRow}>
          <span style={styles.signInText}>Already have an account?</span>
          <Link to="/login" style={styles.signInLink}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
