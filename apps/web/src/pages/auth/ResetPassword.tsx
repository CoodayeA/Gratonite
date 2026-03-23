import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const { addToast } = useToast();
    const navigate = useNavigate();

    if (!token) {
        return (
            <div className="auth-card">
                <h1 className="auth-heading">Invalid Link</h1>
                <p className="auth-subtext">This password reset link is missing or malformed.</p>
                <button className="auth-button" onClick={() => navigate('/login')}>Back to Login</button>
            </div>
        );
    }

    const handleSubmit = async () => {
        if (password.length < 8) {
            addToast({ title: 'Password must be at least 8 characters.', variant: 'error' });
            return;
        }
        if (password !== confirm) {
            addToast({ title: 'Passwords do not match.', variant: 'error' });
            return;
        }
        setLoading(true);
        try {
            await api.auth.resetPassword(token, password);
            setDone(true);
        } catch (err: any) {
            const code = err?.code || '';
            if (code === 'INVALID_TOKEN') {
                addToast({ title: 'This reset link is invalid or has expired. Please request a new one.', variant: 'error' });
            } else if (code === 'VALIDATION_ERROR') {
                addToast({ title: err?.message || 'Invalid input. Please check your password and try again.', variant: 'error' });
            } else {
                addToast({ title: 'Could not reset password. Please check your connection and try again, or request a new reset link.', variant: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="auth-card">
                <h1 className="auth-heading">Password Updated</h1>
                <p className="auth-subtext">Your password has been changed. You can now sign in with your new password.</p>
                <button className="auth-button" onClick={() => navigate('/login')}>Sign In</button>
            </div>
        );
    }

    return (
        <div className="auth-card">
            <h1 className="auth-heading">Reset Password</h1>
            <p className="auth-subtext">Choose a new password for your account.</p>

            <label className="auth-label">New Password</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={showPw ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 16, top: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            <label className="auth-label">Confirm Password</label>
            <input
                type="password"
                className="auth-input"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />

            <button
                className="auth-button"
                onClick={handleSubmit}
                disabled={loading || !password || !confirm}
                style={{ opacity: loading || !password || !confirm ? 0.5 : 1 }}
            >
                {loading ? 'Updating...' : 'Set New Password'}
            </button>
        </div>
    );
};

export default ResetPassword;
