import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiRequestError } from '@/lib/api';
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
      borderRadius: 'var(--radius-sm)',
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
    borderRadius: 'var(--radius-sm)',
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

} as const;

/* ── Component ─────────────────────────────────────────────────────── */

export function RegisterPage() {
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Errors & loading
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Terms validation
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);

    try {
      await api.auth.register({ email, password });
      navigate(`/verify-email/pending?email=${encodeURIComponent(email)}`, { replace: true });
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
        <img
          src={`${import.meta.env.BASE_URL}gratonite-icon.png`}
          alt="Gratonite"
          style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
        />

        {/* Heading */}
        <div>
          <h2 style={styles.heading}>Create Account</h2>
          <p style={styles.subheading}>Join the Gratonite community</p>
        </div>

        {/* Error banner */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Fields */}
        <div style={styles.fieldsGroup}>
          {/* Email */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors['email']?.[0]}
            required
            autoComplete="email"
            autoFocus
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
