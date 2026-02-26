import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

/* ── Spinner keyframes (injected once) ─────────────────────────────── */

const spinnerStyleId = 'verify-email-spinner-keyframes';

function ensureSpinnerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(spinnerStyleId)) return;
  const style = document.createElement('style');
  style.id = spinnerStyleId;
  style.textContent = `
    @keyframes verify-spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/* ── Inline style objects ──────────────────────────────────────────── */

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
    width: 480,
    maxWidth: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    paddingTop: 48,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  } as React.CSSProperties,

  spinnerRing: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '3px solid transparent',
    borderTopColor: 'var(--accent)',
    borderRightColor: 'var(--accent)',
    animation: 'verify-spin 1s linear infinite',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  statusLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    margin: 0,
    marginTop: -8,
  } as React.CSSProperties,

  heading: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.2,
  } as React.CSSProperties,

  description: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 340,
  } as React.CSSProperties,

  emailHighlight: {
    color: 'var(--accent)',
    fontWeight: 500,
  } as React.CSSProperties,

  resendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    marginTop: 4,
  } as React.CSSProperties,

  resendLabel: {
    color: 'var(--text-faint)',
    margin: 0,
  } as React.CSSProperties,

  resendButton: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'none',
  } as React.CSSProperties,

  resendButtonDisabled: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'not-allowed',
    padding: 0,
    opacity: 0.6,
  } as React.CSSProperties,

  feedbackMessage: {
    fontSize: 13,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  } as React.CSSProperties,

  successText: {
    color: 'var(--success-text)',
  } as React.CSSProperties,

  errorText: {
    color: '#f87171',
  } as React.CSSProperties,

  backLink: {
    fontSize: 14,
    color: 'var(--text-faint)',
    textDecoration: 'none',
    marginTop: 4,
  } as React.CSSProperties,

  backLinkAccent: {
    color: 'var(--accent)',
    fontWeight: 500,
  } as React.CSSProperties,
} as const;

/* ── Component ─────────────────────────────────────────────────────── */

export function VerifyEmailPendingPage() {
  ensureSpinnerKeyframes();

  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.auth.requestEmailVerification(email);
      setSuccess(res.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Spinner ring */}
        <div style={styles.spinnerRing} />

        {/* PENDING label */}
        <p style={styles.statusLabel}>PENDING</p>

        {/* Heading */}
        <h2 style={styles.heading}>Check Your Email</h2>

        {/* Description */}
        <p style={styles.description}>
          We sent a verification link to{' '}
          {email ? (
            <span style={styles.emailHighlight}>{email}</span>
          ) : (
            'your email address'
          )}
          . Click the link in your inbox to verify your account.
        </p>

        {/* Feedback messages */}
        {success && (
          <p style={{ ...styles.feedbackMessage, ...styles.successText }}>{success}</p>
        )}
        {error && (
          <p style={{ ...styles.feedbackMessage, ...styles.errorText }}>{error}</p>
        )}

        {/* Resend row */}
        <div style={styles.resendRow}>
          <span style={styles.resendLabel}>Didn&apos;t receive it?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || !email}
            style={loading || !email ? styles.resendButtonDisabled : styles.resendButton}
          >
            {loading ? 'Sending...' : 'Resend email'}
          </button>
        </div>

        {/* Back to Login */}
        <Link to="/login" style={styles.backLink}>
          <span style={styles.backLinkAccent}>Back to Login</span>
        </Link>
      </div>
    </div>
  );
}
