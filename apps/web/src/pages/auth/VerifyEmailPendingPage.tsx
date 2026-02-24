import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

export function VerifyEmailPendingPage() {
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
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
    <div className="auth-form">
      <h2 className="auth-heading">Check your email</h2>
      <p className="auth-subheading">
        Verify your email address to finish setting up your account and sign in.
      </p>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="auth-note">
        We sent a verification link to your inbox. If you do not see it, check spam/junk and then
        request a new link below.
      </div>

      <form onSubmit={handleResend} className="auth-form auth-form-nested">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Button type="submit" loading={loading} className="auth-submit">
          Resend Verification Email
        </Button>
      </form>

      <p className="auth-link">
        Already verified? <Link to="/login">Return to login</Link>
      </p>
    </div>
  );
}
