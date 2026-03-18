import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
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
        if (!login.trim() || !password) {
            addToast({ title: 'Please enter your email/username and password.', variant: 'error' });
            return;
        }
        const code = overrideMfaCode ?? mfaCode;
        if (mfaRequired && code.length !== 6) {
            return;
        }
        setLoading(true);
        try {
            const payload: { login: string; password: string; mfaCode?: string } = { login: login.trim(), password };
            if (code) payload.mfaCode = code;
            const res = await api.auth.login(payload);
            setAccessToken(res.accessToken);
            await refetchUser();
            navigate('/');
        } catch (err: any) {
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
            {/* Mascot with glow */}
            <div className="auth-mascot auth-anim-1">
                <div className="auth-mascot-glow" />
                <img src="/splash-icon.png" alt="Gratonite" />
            </div>

            {/* Heading */}
            <h1 className="auth-heading auth-anim-2">
                {'WELCOME\n'}
                <span className="auth-heading-accent">BACK.</span>
            </h1>
            <p className="auth-subtext auth-anim-2">Sign in to continue to Gratonite</p>

            {/* Pills */}
            <div className="auth-pill-row auth-anim-3">
                <span className="auth-pill">Friend-First</span>
                <span className="auth-pill auth-pill--highlight">Player-Made</span>
                <span className="auth-pill">Open Source</span>
            </div>

            {/* Form */}
            <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="auth-form auth-anim-4">
                <div className="auth-input-group">
                    <Mail size={18} className="auth-input-icon" />
                    <input
                        type="text"
                        placeholder="Email or Username"
                        value={login}
                        onChange={e => setLogin(e.target.value)}
                        required
                    />
                </div>
                <div className="auth-input-group">
                    <Lock size={18} className="auth-input-icon" />
                    <input
                        type={showPw ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {/* MFA section */}
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

                {/* Forgot password section */}
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
                            type="button"
                            onClick={handleResetSubmit}
                            className="auth-button"
                            style={{ marginTop: 0, opacity: resetEmail.trim() ? 1 : 0.5 }}
                        >
                            Send Reset Link
                        </button>
                    </div>
                )}

                {/* Forgot password link */}
                <button
                    type="button"
                    onClick={() => setShowResetForm(prev => !prev)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-end', padding: 0 }}
                >
                    Forgot password?
                </button>

                <button
                    type="submit"
                    className="auth-button"
                    disabled={loading || !login.trim() || !password || (mfaRequired && mfaCode.length !== 6)}
                    style={{ opacity: loading || !login.trim() || !password || (mfaRequired && mfaCode.length !== 6) ? 0.5 : 1 }}
                >
                    {loading ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
                </button>
            </form>

            {/* Rainbow strip */}
            <div className="auth-rainbow-strip auth-anim-5">
                <span style={{ background: '#6c63ff' }} />
                <span style={{ background: '#f59e0b' }} />
                <span style={{ background: '#ef4444' }} />
                <span style={{ background: '#22c55e' }} />
                <span style={{ background: '#3b82f6' }} />
                <span style={{ background: '#8b5cf6' }} />
            </div>

            {/* Stats row */}
            <div className="auth-stats-row auth-anim-6">
                <div>
                    <div className="auth-stat-value">Zero Cost</div>
                    <div className="auth-stat-label">Always</div>
                </div>
                <div>
                    <div className="auth-stat-value">No Ads</div>
                    <div className="auth-stat-label">Ever</div>
                </div>
                <div>
                    <div className="auth-stat-value">Your Data</div>
                    <div className="auth-stat-label">Yours</div>
                </div>
            </div>

            {/* Sign up link */}
            <p className="auth-anim-7" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: 'var(--accent-primary)' }}>Sign up</Link>
            </p>
        </div>
    );
};

export default Login;
