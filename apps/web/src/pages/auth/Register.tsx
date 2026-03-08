import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

const TERMS_TEXT = `Terms of Service for Gratonite

By using Gratonite, you agree to the following terms:

1. You must be at least 13 years of age to use this service.
2. You are responsible for maintaining the security of your account credentials.
3. You agree not to use the platform for any unlawful or abusive purposes, including harassment, spam, or distribution of harmful content.
4. Gratonite reserves the right to suspend or terminate accounts that violate these terms.
5. All user-generated content remains the property of the respective user, but Gratonite is granted a license to display it within the platform.

These terms may be updated periodically. Continued use of the service constitutes acceptance of any changes.`;

const PRIVACY_TEXT = `Privacy Policy for Gratonite

Your privacy matters to us. Here is how we handle your data:

1. We collect only the information necessary to provide and improve the service, such as your email, username, and usage analytics.
2. We do not sell your personal data to third parties.
3. Data is stored securely using industry-standard encryption practices.
4. You may request deletion of your account and associated data at any time through your account settings.
5. We use cookies to maintain session state and improve your experience. You can manage cookie preferences in your browser.

For questions about this policy, contact privacy@gratonite.app.`;

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidUsername = (v: string) => /^[a-zA-Z0-9_]{3,32}$/.test(v);

const getPasswordStrength = (pw: string): { label: string; color: string } => {
    if (pw.length < 8) return { label: '', color: '' };
    let variety = 0;
    if (/[a-z]/.test(pw)) variety++;
    if (/[A-Z]/.test(pw)) variety++;
    if (/[0-9]/.test(pw)) variety++;
    if (/[^a-zA-Z0-9]/.test(pw)) variety++;
    if (pw.length >= 12 && variety >= 3) return { label: 'Strong', color: '#22c55e' };
    if (pw.length >= 8 && variety >= 2) return { label: 'Medium', color: '#eab308' };
    return { label: 'Weak', color: '#ef4444' };
};

const Register = () => {
    const [showPw, setShowPw] = useState(false);
    const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | null>(null);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const { addToast } = useToast();
    const navigate = useNavigate();

    const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

    const emailError = email.trim() && !isValidEmail(email.trim()) ? 'Must be a valid email' : '';
    const usernameError = username.trim().length > 0 && !isValidUsername(username.trim())
        ? 'Must be 3-32 characters (letters, numbers, underscores)' : '';
    const passwordError = password.length > 0 && password.length < 8
        ? 'Must be at least 8 characters' : '';
    const passwordStrength = getPasswordStrength(password);

    const handleRegister = async () => {
        // Mark all fields as touched so errors show
        setTouched({ email: true, username: true, password: true });

        // Client-side validation — return early if any field is invalid
        if (!email.trim() || !isValidEmail(email.trim())) return;
        if (!username.trim() || !isValidUsername(username.trim())) return;
        if (!password || password.length < 8) return;
        if (!agreed) return;

        setLoading(true);
        try {
            await api.auth.register({ email: email.trim(), username: username.trim(), password });
            navigate(`/verify?email=${encodeURIComponent(email.trim())}`);
        } catch (err: any) {
            const code = err?.code || err?.message || '';
            if (code === 'EMAIL_IN_USE') {
                addToast({ title: 'That email is already registered.', variant: 'error' });
            } else if (code === 'USERNAME_TAKEN') {
                addToast({ title: 'That username is taken.', variant: 'error' });
            } else if (err?.details) {
                const firstErr = Object.values(err.details).flat()[0] as string;
                addToast({ title: firstErr || 'Validation error.', variant: 'error' });
            } else {
                addToast({ title: 'Registration failed. Please try again.', variant: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = email.trim() && username.trim() && password && agreed && !loading;

    return (
        <div className="auth-card">
            <h1 className="auth-heading">Create Account</h1>
            <p className="auth-subtext">Join the Gratonite community</p>

            <label className="auth-label">Email</label>
            <input
                type="email"
                className="auth-input"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => markTouched('email')}
                style={touched.email && emailError ? { borderColor: 'var(--danger, #ef4444)' } : undefined}
            />
            {touched.email && emailError && (
                <p style={{ color: 'var(--danger, #ef4444)', fontSize: '12px', margin: '4px 0 0 0' }}>{emailError}</p>
            )}

            <label className="auth-label">Username</label>
            <input
                type="text"
                className="auth-input"
                placeholder="Choose a username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onBlur={() => markTouched('username')}
                style={touched.username && usernameError ? { borderColor: 'var(--danger, #ef4444)' } : undefined}
            />
            {touched.username && usernameError && (
                <p style={{ color: 'var(--danger, #ef4444)', fontSize: '12px', margin: '4px 0 0 0' }}>{usernameError}</p>
            )}

            <label className="auth-label">Password</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={showPw ? "text" : "password"}
                    className="auth-input"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => markTouched('password')}
                    onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                    style={touched.password && passwordError ? { borderColor: 'var(--danger, #ef4444)' } : undefined}
                />
                <button
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: 16, top: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {touched.password && passwordError && (
                <p style={{ color: 'var(--danger, #ef4444)', fontSize: '12px', margin: '4px 0 0 0' }}>{passwordError}</p>
            )}
            {password.length >= 8 && passwordStrength.label && (
                <p style={{ color: passwordStrength.color, fontSize: '12px', margin: '4px 0 0 0', fontWeight: 500 }}>
                    Strength: {passwordStrength.label}
                </p>
            )}

            <div className="auth-checkbox-wrapper">
                <input type="checkbox" id="terms" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                <label htmlFor="terms">
                    I agree to the <span onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }} className="auth-link" style={{ cursor: 'pointer' }}>Terms of Service</span> and <span onClick={(e) => { e.preventDefault(); setActiveModal('privacy'); }} className="auth-link" style={{ cursor: 'pointer' }}>Privacy Policy</span>
                </label>
            </div>

            <button
                className="auth-button"
                onClick={handleRegister}
                disabled={!canSubmit}
                style={{ opacity: canSubmit ? 1 : 0.5 }}
            >
                {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
            </div>

            {/* Terms / Privacy Modal */}
            {activeModal && (
                <div
                    onClick={() => setActiveModal(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--stroke)',
                            borderRadius: '12px',
                            width: '100%',
                            maxWidth: '520px',
                            maxHeight: '70vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--stroke)',
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                                {activeModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                            </h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{
                            padding: '20px',
                            overflowY: 'auto',
                            flex: 1,
                        }}>
                            <pre style={{
                                fontSize: '13px',
                                lineHeight: 1.7,
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                margin: 0,
                                fontFamily: 'inherit',
                            }}>
                                {activeModal === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
                            </pre>
                        </div>
                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid var(--stroke)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                        }}>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="auth-button"
                                style={{ marginTop: 0, width: 'auto', padding: '0 24px', height: '36px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Register;
