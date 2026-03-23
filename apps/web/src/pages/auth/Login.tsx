import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, setAccessToken } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import gsap from 'gsap';

const Login = () => {
    const [showPw, setShowPw] = useState(false);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResetForm, setShowResetForm] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [useRecoveryCode, setUseRecoveryCode] = useState(false);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { refetchUser } = useUser();
    const cardRef = useRef<HTMLDivElement>(null);

    // GSAP entrance animation
    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced || !cardRef.current) return;
        const els = cardRef.current.querySelectorAll('[data-auth-anim]');
        gsap.from(els, { y: -16, opacity: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' });
    }, []);

    const handleLogin = async (overrideMfaCode?: string) => {
        if (!login.trim() || !password) {
            addToast({ title: 'Please enter your email/username and password.', variant: 'error' });
            return;
        }
        const code = overrideMfaCode ?? mfaCode;
        const codeReady = useRecoveryCode ? code.replace(/[^a-zA-Z0-9]/g, '').length === 8 : code.length === 6;
        if (mfaRequired && !codeReady) {
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
                if (cardRef.current) gsap.to(cardRef.current, { x: [-8, 8, -6, 6, -3, 3, 0], duration: 0.5, ease: 'power2.out' });
            } else if (errCode === 'INVALID_MFA_CODE') {
                addToast({ title: useRecoveryCode ? 'Invalid recovery code. Please check and try again.' : 'Invalid authenticator code. Try again or use a recovery code.', variant: 'error' });
                setMfaCode('');
                if (cardRef.current) gsap.to(cardRef.current, { x: [-8, 8, -6, 6, -3, 3, 0], duration: 0.5, ease: 'power2.out' });
            } else {
                addToast({ title: 'Login failed. Please try again.', variant: 'error' });
                if (cardRef.current) gsap.to(cardRef.current, { x: [-8, 8, -6, 6, -3, 3, 0], duration: 0.5, ease: 'power2.out' });
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
            addToast({ title: 'Could not send reset email. Please check your connection and try again.', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card" ref={cardRef}>
            {/* Mascot with glow */}
            <div className="auth-mascot" data-auth-anim>
                <div className="auth-mascot-glow" />
                <img src={`${import.meta.env.BASE_URL}splash-icon.png`} alt="Gratonite" />
            </div>

            {/* Heading */}
            <h1 className="auth-heading" data-auth-anim>
                {'WELCOME\n'}
                <span className="auth-heading-accent">BACK.</span>
            </h1>
            <p className="auth-subtext" data-auth-anim>Sign in to continue to Gratonite</p>

            {/* Pills */}
            <div className="auth-pill-row" data-auth-anim>
                <span className="auth-pill">Friend-First</span>
                <span className="auth-pill auth-pill--highlight">Player-Made</span>
                <span className="auth-pill">Open Source</span>
            </div>

            {/* Form */}
            <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="auth-form" data-auth-anim>
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
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {useRecoveryCode ? 'Recovery Code' : 'Two-Factor Authentication'}
                            </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            {useRecoveryCode
                                ? 'Enter one of the recovery codes you saved when setting up 2FA.'
                                : 'Enter the 6-digit code from your authenticator app.'}
                        </p>
                        {useRecoveryCode ? (
                            <input
                                type="text"
                                className="auth-input"
                                placeholder="XXXX-XXXX"
                                maxLength={9}
                                value={mfaCode}
                                onChange={e => {
                                    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                                    setMfaCode(raw.slice(0, 9));
                                }}
                                onKeyDown={e => { if (e.key === 'Enter' && mfaCode.replace(/[^A-Z0-9]/g, '').length === 8) handleLogin(); }}
                                style={{ textAlign: 'center', letterSpacing: '4px', fontFamily: 'monospace', fontSize: '20px', marginBottom: 0 }}
                                autoFocus
                            />
                        ) : (
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
                        )}
                        <button
                            type="button"
                            onClick={() => { setUseRecoveryCode(!useRecoveryCode); setMfaCode(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', padding: 0, alignSelf: 'center' }}
                        >
                            {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
                        </button>
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
                    disabled={loading || !login.trim() || !password || (mfaRequired && (useRecoveryCode ? mfaCode.replace(/[^A-Z0-9]/g, '').length !== 8 : mfaCode.length !== 6))}
                    style={{ opacity: loading || !login.trim() || !password || (mfaRequired && (useRecoveryCode ? mfaCode.replace(/[^A-Z0-9]/g, '').length !== 8 : mfaCode.length !== 6)) ? 0.5 : 1 }}
                >
                    {loading ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
                </button>
            </form>

            {/* Federated Login — "Login with Gratonite" */}
            <FederatedLoginButton />

            {/* Rainbow strip */}
            <div className="auth-rainbow-strip" data-auth-anim>
                <span style={{ background: '#6c63ff' }} />
                <span style={{ background: '#f59e0b' }} />
                <span style={{ background: '#ef4444' }} />
                <span style={{ background: '#22c55e' }} />
                <span style={{ background: '#3b82f6' }} />
                <span style={{ background: '#8b5cf6' }} />
            </div>

            {/* Stats row */}
            <div className="auth-stats-row" data-auth-anim>
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
            <p data-auth-anim style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: 'var(--accent-primary)' }}>Sign up</Link>
            </p>
        </div>
    );
};

/**
 * FederatedLoginButton — shows "Login with Gratonite" if federation SSO is configured.
 * Only renders on self-hosted instances, not on gratonite.chat itself.
 */
function FederatedLoginButton() {
    const [config, setConfig] = useState<{ enabled: boolean; hubName: string } | null>(null);

    useEffect(() => {
        fetch(`${(import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1$/, '')}/api/v1/auth/federated/config`)
            .then(r => r.json())
            .then(data => setConfig(data))
            .catch(() => setConfig(null));
    }, []);

    if (!config?.enabled) return null;

    const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1$/, '');

    return (
        <div data-auth-anim style={{ width: '100%', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 12px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
            </div>
            <a
                href={`${API_BASE}/api/v1/auth/federated/login`}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    width: '100%', padding: '12px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontWeight: 600, fontSize: '14px',
                    textDecoration: 'none', border: 'none', cursor: 'pointer',
                    transition: 'opacity 0.15s',
                }}
            >
                Login with {config.hubName}
            </a>
        </div>
    );
}

export default Login;
