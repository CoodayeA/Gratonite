import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/ui/ToastManager';
import { api, setAccessToken } from '../../lib/api';

const Verify = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [cooldown, setCooldown] = useState(60);
    const [verifying, setVerifying] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    // If there's a token in the URL, auto-verify
    const confirmToken = useCallback(async (t: string) => {
        setVerifying(true);
        try {
            const res = await api.auth.confirmEmailVerification(t);
            if (res.accessToken) {
                setAccessToken(res.accessToken);
            }
            addToast({ title: 'Email verified! Redirecting...', variant: 'success' });
            setTimeout(() => navigate('/'), 1500);
        } catch {
            addToast({ title: 'Verification link is invalid or expired.', variant: 'error' });
            setVerifying(false);
        }
    }, [addToast, navigate]);

    useEffect(() => {
        if (token) {
            confirmToken(token);
        }
    }, [token, confirmToken]);

    // Cooldown timer for resend
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (!email) {
            addToast({ title: 'Unable to resend — email address not available. Please register again.', variant: 'error' });
            return;
        }
        try {
            await api.auth.requestEmailVerification(email);
            addToast({ title: 'Verification email resent.', variant: 'success' });
            setCooldown(60);
        } catch {
            addToast({ title: 'Failed to resend verification email. Please try again.', variant: 'error' });
        }
    };

    if (verifying) {
        return (
            <div className="auth-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="spinner"></div>
                <h1 className="auth-heading" style={{ marginBottom: '16px' }}>Verifying...</h1>
                <p className="auth-subtext">Please wait while we verify your email.</p>
            </div>
        );
    }

    return (
        <div className="auth-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="spinner"></div>

            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-primary)', marginBottom: '16px', fontWeight: 600 }}>
                Pending
            </div>

            <h1 className="auth-heading" style={{ marginBottom: '16px' }}>Check Your Email</h1>

            <p className="auth-subtext" style={{ maxWidth: '360px', margin: '0 auto 32px' }}>
                We sent a verification link to your email address. Click the link in your inbox to verify your account.
            </p>

            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                Didn't receive it?{' '}
                <button
                    onClick={handleResend}
                    disabled={cooldown > 0}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: cooldown > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                        cursor: cooldown > 0 ? 'default' : 'pointer',
                        fontWeight: 600,
                        fontSize: '14px',
                    }}
                >
                    {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
                </button>
            </div>

            <Link to="/login" className="auth-link" style={{ fontSize: '14px', fontWeight: 600 }}>Back to Login</Link>
        </div>
    );
};

export default Verify;
