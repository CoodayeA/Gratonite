import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

/* ---------- styles ---------- */

const S = {
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  } as React.CSSProperties,
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  logo: {
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
  } as React.CSSProperties,
  headingWrap: {
    textAlign: 'center',
  } as React.CSSProperties,
  heading: {
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
    margin: 0,
  } as React.CSSProperties,
  subheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  authError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  fieldsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  forgotLink: {
    fontSize: 13,
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'none',
  } as React.CSSProperties,
  submitBtn: {
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    height: 48,
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    width: '100%',
  } as React.CSSProperties,
  signupText: {
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--text-faint)',
    margin: 0,
  } as React.CSSProperties,
  signupLink: {
    color: 'var(--accent)',
    fontWeight: 500,
  } as React.CSSProperties,
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--stroke)',
  } as React.CSSProperties,
  dividerText: {
    fontSize: 12,
    color: 'var(--text-faint)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    fontWeight: 500,
  } as React.CSSProperties,
  oauthRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,
  oauthBtn: {
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
  verifyText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  verifyLink: {
    color: 'var(--accent)',
  } as React.CSSProperties,
  mfaOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  mfaForm: {
    width: 420,
    maxWidth: '90vw',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 48,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } as React.CSSProperties,
  mfaIconWrap: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  mfaIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'var(--gold-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  mfaHeadingWrap: {
    textAlign: 'center',
  } as React.CSSProperties,
  mfaHeading: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    marginBottom: 8,
  } as React.CSSProperties,
  mfaSubheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  mfaDigitsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
  } as React.CSSProperties,
  mfaDigitInput: {
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
  } as React.CSSProperties,
  mfaToggle: {
    textAlign: 'center',
  } as React.CSSProperties,
  mfaToggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
  } as React.CSSProperties,
};

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
        displayName: me.profile?.displayName ?? me.username,
        avatarHash: me.profile?.avatarHash ?? null,
        tier: me.profile?.tier ?? 'free',
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
      <form style={S.authForm} onSubmit={handleSubmit}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logo}>
            G
          </div>
        </div>

        {/* Heading */}
        <div style={S.headingWrap}>
          <h2 style={S.heading}>
            Welcome Back
          </h2>
          <p style={S.subheading}>
            Sign in to your Gratonite account
          </p>
        </div>

        {/* Error */}
        {error && !mfaRequired && <div style={S.authError}>{error}</div>}

        {/* Fields */}
        <div style={S.fieldsGroup}>
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

          <div style={S.forgotRow}>
            <Link
              to="/forgot-password"
              style={S.forgotLink}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Sign In button */}
        <Button
          type="submit"
          loading={loading}
          style={S.submitBtn}
        >
          Sign In
        </Button>

        {/* Sign up link */}
        <p style={S.signupText}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={S.signupLink}>
            Sign up
          </Link>
        </p>

        {/* Divider */}
        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>or</span>
          <div style={S.dividerLine} />
        </div>

        {/* OAuth buttons */}
        <div style={S.oauthRow}>
          {/* Google */}
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/google`; }}
            style={S.oauthBtn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          {/* Apple */}
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/apple`; }}
            style={S.oauthBtn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </button>
          {/* Facebook */}
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? '/api/v1'}/auth/facebook`; }}
            style={S.oauthBtn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
        </div>

        {showVerifyLink && (
          <p style={S.verifyText}>
            <Link
              to={`/verify-email/pending?email=${encodeURIComponent(loginField.includes('@') ? loginField : '')}`}
              style={S.verifyLink}
            >
              Resend verification email
            </Link>
          </p>
        )}
      </form>

      {/* MFA Overlay */}
      {mfaRequired && (
        <div
          style={S.mfaOverlay}
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
            style={S.mfaForm}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MFA Icon */}
            <div style={S.mfaIconWrap}>
              <div style={S.mfaIcon}>
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
            <div style={S.mfaHeadingWrap}>
              <h3 style={S.mfaHeading}>
                Two-Factor Authentication
              </h3>
              <p style={S.mfaSubheading}>
                {mfaMode === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter one of your backup codes'}
              </p>
            </div>

            {/* Error in MFA modal */}
            {error && <div style={S.authError}>{error}</div>}

            {/* TOTP digit inputs */}
            {mfaMode === 'totp' ? (
              <div style={S.mfaDigitsRow}>
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
                    style={S.mfaDigitInput}
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
              style={S.submitBtn}
            >
              Verify
            </Button>

            {/* Toggle MFA mode link */}
            <div style={S.mfaToggle}>
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
                style={S.mfaToggleBtn}
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
