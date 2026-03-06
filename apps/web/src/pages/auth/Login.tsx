import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, setAccessToken } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';

const Login = () => {
    const [showPw, setShowPw] = useState(false);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResetForm, setShowResetForm] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { refetchUser } = useUser();

    const handleLogin = async (overrideMfaCode?: string) => {
        console.log('[Login] handleLogin called');
        if (!login.trim() || !password) {
            console.log('[Login] Validation failed - login or password empty');
            alert('DEBUG: Login or password is empty');
            return;
        }
        const code = overrideMfaCode ?? mfaCode;
        if (mfaRequired && code.length !== 6) {
            console.log('[Login] MFA validation failed');
            return;
        }
        setLoading(true);
        try {
            const payload: { login: string; password: string; mfaCode?: string } = { login: login.trim(), password };
            if (code) payload.mfaCode = code;
            console.log('[Login] Attempting login with payload:', { login: payload.login, hasPassword: !!payload.password, hasMfaCode: !!payload.mfaCode });
            const res = await api.auth.login(payload);
            console.log('[Login] Login successful, setting token');
            setAccessToken(res.accessToken);
            await refetchUser();
            navigate('/');
        } catch (err: any) {
            console.error('[Login] Login failed:', err);
            alert(`DEBUG: Login failed - ${err?.code || err?.message || 'Unknown error'}`);
            const errCode = err?.code || err?.message || '';
            if (errCode === 'MFA_REQUIRED') {
                setMfaRequired(true);
                setMfaCode('');
            } else if (errCode === 'INVALID_CREDENTIALS') {
                addToast({ title: 'Invalid email/username or password.', variant: 'error' });
            } else if (errCode === 'INVALID_MFA_CODE') {
                addToast({ title: 'Invalid authenticator code. Please try again.', variant: 'error' });
                setMfaCode('');
            } else {
                addToast({ title: 'Login failed. Please try again.', variant: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async () => {
        if (!resetEmail.trim()) return;
        setLoading(true);
        try {
            await api.auth.forgotPassword(resetEmail.trim());
            addToast({ title: 'If that email is registered, a reset link has been sent.', variant: 'success' });
            setResetEmail('');
            setShowResetForm(false);
        } catch {
            addToast({ title: 'Something went wrong. Please try again.', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card">
            <h1 className="auth-heading">Welcome Back</h1>
            <p className="auth-subtext">Sign in to your Gratonite account</p>

            <label className="auth-label">Email or Username</label>
            <input
                type="text"
                className="auth-input"
                placeholder="Enter your email or username"
                value={login}
                onChange={e => setLogin(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            />

            <label className="auth-label">Password</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={showPw ? "text" : "password"}
                    className="auth-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                />
                <button
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 16, top: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px', marginBottom: '8px' }}>
                <span onClick={() => setShowResetForm(prev => !prev)} className="auth-link" style={{ fontSize: '14px', cursor: 'pointer' }}>Forgot password?</span>
            </div>

            {mfaRequired && (
                <div style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Two-Factor Authentication</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                        Enter the 6-digit code from your authenticator app.
                    </p>
                    <input
                        type="text"
                        className="auth-input"
                        placeholder="000000"
                        maxLength={6}
                        value={mfaCode}
                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => { if (e.key === 'Enter' && mfaCode.length === 6) handleLogin(); }}
                        style={{ textAlign: 'center', letterSpacing: '8px', fontFamily: 'monospace', fontSize: '20px', marginBottom: 0 }}
                        autoFocus
                    />
                </div>
            )}

            {showResetForm && (
                <div style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowLeft size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowResetForm(false)} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Reset Password</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                        Enter your email address and we'll send you a reset link.
                    </p>
                    <div style={{ position: 'relative' }}>
                        <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                        <input
                            type="email"
                            className="auth-input"
                            placeholder="Enter your email"
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleResetSubmit(); }}
                            style={{ paddingLeft: '36px', marginBottom: 0 }}
                        />
                    </div>
                    <button
                        onClick={handleResetSubmit}
                        className="auth-button"
                        style={{ marginTop: 0, opacity: resetEmail.trim() ? 1 : 0.5 }}
                    >
                        Send Reset Link
                    </button>
                </div>
            )}

            <button
                className="auth-button"
                onClick={() => handleLogin()}
                disabled={loading || !login.trim() || !password || (mfaRequired && mfaCode.length !== 6)}
                style={{ opacity: loading || !login.trim() || !password || (mfaRequired && mfaCode.length !== 6) ? 0.5 : 1 }}
            >
                {loading ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Don't have an account? <Link to="/register" className="auth-link">Sign up</Link>
            </div>
        </div>
    );
};

export default Login;
