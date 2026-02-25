import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBackupCode, setMfaBackupCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMode, setMfaMode] = useState<'totp' | 'backup'>('totp');
  const [error, setError] = useState('');
  const [showVerifyLink, setShowVerifyLink] = useState(false);
  const [loading, setLoading] = useState(false);

  // Individual digit state for MFA TOTP input
  const [mfaDigits, setMfaDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  // Sync mfaDigits to mfaCode
  useEffect(() => {
    setMfaCode(mfaDigits.join(''));
  }, [mfaDigits]);

  // Auto-focus first digit input when MFA overlay opens in totp mode
  useEffect(() => {
    if (mfaRequired && mfaMode === 'totp') {
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    }
  }, [mfaRequired, mfaMode]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...mfaDigits];
    newDigits[index] = digit;
    setMfaDigits(newDigits);

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...mfaDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setMfaDigits(newDigits);
    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setShowVerifyLink(false);
    setLoading(true);

    try {
      const res = await api.auth.login({
        login: loginField,
        password,
        mfaCode: mfaRequired && mfaMode === 'totp' ? mfaCode : undefined,
        mfaBackupCode: mfaRequired && mfaMode === 'backup' ? mfaBackupCode : undefined,
      });
      setAccessToken(res.accessToken);

      // Fetch full user profile
      const me = await api.users.getMe();
      login({
        id: me.id,
        username: me.username,
        email: me.email,
        displayName: me.profile.displayName,
        avatarHash: me.profile.avatarHash,
        tier: me.profile.tier,
      });

      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          setShowVerifyLink(true);
        }
        if (err.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError('Enter your 2FA code to continue.');
          return;
        }
        if (err.code === 'INVALID_MFA_CODE') {
          setMfaRequired(true);
        }
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    handleSubmit(e);
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} style={{ gap: '28px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-on-gold)',
              userSelect: 'none',
            }}
          >
            G
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center' }}>
          <h2
            className="auth-heading"
            style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}
          >
            Welcome Back
          </h2>
          <p className="auth-subheading" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Sign in to your Gratonite account
          </p>
        </div>

        {/* Error */}
        {error && !mfaRequired && <div className="auth-error">{error}</div>}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email or Username"
            type="text"
            value={loginField}
            onChange={(e) => setLoginField(e.target.value)}
            required
            autoComplete="username"
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              to="/forgot-password"
              style={{
                fontSize: 13,
                color: 'var(--accent)',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Sign In button */}
        <Button
          type="submit"
          loading={loading}
          className="auth-submit"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-on-gold)',
            height: 48,
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            width: '100%',
          }}
        >
          Sign In
        </Button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
        </div>

        {/* OAuth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={() => alert('Coming soon')}
            style={{
              height: 44,
              borderRadius: 6,
              border: '1px solid var(--stroke)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => alert('Coming soon')}
            style={{
              height: 44,
              borderRadius: 6,
              border: '1px solid var(--stroke)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Continue with Discord
          </button>
        </div>

        {/* Sign up link */}
        <p
          className="auth-link"
          style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-faint)' }}
        >
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>
            Sign up
          </Link>
        </p>

        {showVerifyLink && (
          <p className="auth-link" style={{ textAlign: 'center' }}>
            <Link
              to={`/verify-email/pending?email=${encodeURIComponent(loginField.includes('@') ? loginField : '')}`}
              style={{ color: 'var(--accent)' }}
            >
              Resend verification email
            </Link>
          </p>
        )}
      </form>

      {/* MFA Overlay */}
      {mfaRequired && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMfaRequired(false);
              setMfaDigits(['', '', '', '', '', '']);
              setMfaCode('');
              setMfaBackupCode('');
              setError('');
            }
          }}
        >
          <form
            onSubmit={handleMfaSubmit}
            style={{
              width: 420,
              maxWidth: '90vw',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 10,
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MFA Icon */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: 'var(--gold-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
            </div>

            {/* MFA Heading */}
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--text)',
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Two-Factor Authentication
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                {mfaMode === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter one of your backup codes'}
              </p>
            </div>

            {/* Error in MFA modal */}
            {error && <div className="auth-error">{error}</div>}

            {/* TOTP digit inputs */}
            {mfaMode === 'totp' ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {mfaDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={i === 0 ? handleDigitPaste : undefined}
                    style={{
                      width: 48,
                      height: 56,
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: 600,
                      color: 'var(--text)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--stroke)',
                      borderRadius: 8,
                      outline: 'none',
                      caretColor: 'var(--accent)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--stroke)';
                    }}
                  />
                ))}
              </div>
            ) : (
              <Input
                label="Backup code"
                type="text"
                value={mfaBackupCode}
                onChange={(e) => setMfaBackupCode(e.target.value.toUpperCase())}
                hint="Backup codes can only be used once."
                autoFocus
              />
            )}

            {/* Verify button */}
            <Button
              type="submit"
              loading={loading}
              style={{
                background: 'var(--accent)',
                color: 'var(--text-on-gold)',
                height: 48,
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                width: '100%',
              }}
            >
              Verify
            </Button>

            {/* Toggle MFA mode link */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (mfaMode === 'totp') {
                    setMfaMode('backup');
                  } else {
                    setMfaMode('totp');
                    setMfaDigits(['', '', '', '', '', '']);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {mfaMode === 'totp' ? 'Use backup code instead' : 'Use authenticator app instead'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
