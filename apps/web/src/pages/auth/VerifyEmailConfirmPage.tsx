import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type VerifyState = 'loading' | 'success' | 'error';

export function VerifyEmailConfirmPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);

  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setState('error');
        setMessage('Verification link is missing a token.');
        return;
      }

      try {
        const res = await api.auth.confirmEmailVerification(token);
        if (cancelled) return;
        setState('success');
        setMessage(res.message);
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setMessage(getErrorMessage(err));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="auth-form">
      <h2 className="auth-heading">
        {state === 'loading' && 'Verifying Email'}
        {state === 'success' && 'Email Verified'}
        {state === 'error' && 'Verification Failed'}
      </h2>

      <p className="auth-subheading">{message}</p>

      {state === 'loading' ? (
        <div className="auth-note">This usually takes a second.</div>
      ) : null}

      {state === 'success' ? (
        <>
          <div className="auth-success">Your email is now verified. You can sign in.</div>
          <Link to="/login" className="auth-button-link">
            <Button className="auth-submit">Go to Login</Button>
          </Link>
        </>
      ) : null}

      {state === 'error' ? (
        <>
          <div className="auth-note">
            The link may be expired or invalid. Request a new verification email and try again.
          </div>
          <Link
            to={email ? `/verify-email/pending?email=${encodeURIComponent(email)}` : '/verify-email/pending'}
            className="auth-button-link"
          >
            <Button className="auth-submit" variant="ghost">
              Request New Link
            </Button>
          </Link>
        </>
      ) : null}
    </div>
  );
}
