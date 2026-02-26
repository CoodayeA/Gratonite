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
