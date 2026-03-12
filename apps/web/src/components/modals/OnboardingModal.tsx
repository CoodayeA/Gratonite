import { useState, useEffect, useRef } from 'react';
import { Camera, ChevronRight, X, Sparkles, Plus, Check, Moon, Sun, Type, LayoutTemplate, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ui/ThemeProvider';
import { api } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';

const OnboardingModal = ({ onClose }: { onClose: () => void }) => {
    const [step, setStep] = useState(1);
    const [bio, setBio] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { theme, setTheme, colorMode, setColorMode, fontFamily, setFontFamily } = useTheme();
    const { user, updateUser, refetchUser } = useUser();
    const navigate = useNavigate();

    // Initialize display name from user context
    useEffect(() => {
        if (user.name) setDisplayName(user.name);
    }, [user.name]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const tags = ['Gaming', 'Music', 'Art', 'Tech', 'Anime', 'Sports', 'Movies', 'Coding', 'Science', 'Books'];

    const toggleTag = (tag: string) => {
        if (activeTags.includes(tag)) {
            setActiveTags(activeTags.filter(t => t !== tag));
        } else {
            setActiveTags([...activeTags, tag]);
        }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onload = () => setAvatarPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleComplete = async () => {
        setSaving(true);
        try {
            // Save display name, bio, interests, and mark onboarding complete
            await api.users.updateProfile({
                displayName: displayName.trim() || undefined,
                bio: bio.trim() || undefined,
                interests: activeTags.length > 0 ? activeTags : null,
                onboardingCompleted: true,
            });

            // Upload avatar if user picked one
            if (avatarFile) {
                await api.users.uploadAvatar(avatarFile).catch(() => {
                    // Non-critical — avatar upload failure should not block onboarding
                });
            }

            // Theme/font preferences are already saved via ThemeProvider (localStorage)
            // so no additional API call needed for those.

            // Update local user context so the onboarding modal doesn't re-trigger
            updateUser({
                name: displayName.trim() || user.name,
                onboardingCompleted: true,
            });

            // Re-fetch user from API to ensure context is fully in sync with DB
            refetchUser().catch(() => {});

            onClose();
            navigate('/');
        } catch {
            // If save fails, still close and mark locally so modal doesn't
            // re-trigger in this session. On next reload the API will be
            // checked again.
            updateUser({ onboardingCompleted: true });
            onClose();
            navigate('/');
        } finally {
            setSaving(false);
        }
    };

    const handleNext = () => {
        if (step < 6) setStep(step + 1);
        else {
            handleComplete();
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
            <div className="auth-card wide glass-panel" style={{ width: 'min(480px, 95vw)', position: 'relative', animation: 'slideIn 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
                    {[1, 2, 3, 4, 5, 6].map(s => (
                        <div key={s} style={{ height: '4px', flex: 1, background: s <= step ? 'var(--accent-primary)' : 'var(--bg-tertiary)', borderRadius: '2px', transition: 'background 0.3s' }}></div>
                    ))}
                </div>

                {step === 1 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', background: 'var(--accent-purple)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Sparkles size={40} color="white" />
                        </div>
                        <h1 className="auth-heading">Welcome to Gratonite</h1>
                        <p className="auth-subtext">Let's set up your profile so people know who you are.</p>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Choose an Avatar</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>You can always change this later.</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleAvatarSelect}
                        />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{ width: '120px', height: '120px', borderRadius: '50%', background: avatarPreview ? `url(${avatarPreview}) center/cover` : 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', border: '4px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '16px', position: 'relative', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}
                        >
                            {!avatarPreview && <Camera size={32} color="rgba(255,255,255,0.8)" />}
                            <div style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--bg-elevated)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--stroke)' }}>
                                <Plus size={20} />
                            </div>
                        </div>
                        <span
                            onClick={() => fileInputRef.current?.click()}
                            style={{ fontSize: '13px', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}
                        >Browse Files</span>
                    </div>
                )}

                {step === 3 && (
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Who are you?</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Set your display name and a short bio.</p>

                        <label className="auth-label">Display Name</label>
                        <input type="text" className="auth-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />

                        <label className="auth-label" style={{ marginTop: '16px' }}>Bio</label>
                        <div style={{ position: 'relative' }}>
                            <textarea
                                className="auth-input"
                                style={{ height: '100px', paddingTop: '16px', resize: 'none' }}
                                placeholder="Tell us about yourself..."
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={200}
                            ></textarea>
                            <div style={{ position: 'absolute', bottom: '36px', right: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {bio.length}/200
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Customize Your Vibe</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Make Gratonite uniquely yours before we begin.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Color Mode */}
                            <div>
                                <label className="auth-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Sun size={14} /> Color Mode
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        onClick={() => setColorMode('light')}
                                        style={{ padding: '12px', background: colorMode === 'light' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: colorMode === 'light' ? '#000' : 'var(--text-primary)', border: colorMode === 'light' ? '2px solid #000' : '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                                    ><Sun size={16} /> Light</button>
                                    <button
                                        onClick={() => setColorMode('dark')}
                                        style={{ padding: '12px', background: colorMode === 'dark' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: colorMode === 'dark' ? '#000' : 'var(--text-primary)', border: colorMode === 'dark' ? '2px solid #000' : '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                                    ><Moon size={16} /> Dark</button>
                                </div>
                            </div>

                            {/* Theme Base */}
                            <div>
                                <label className="auth-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <LayoutTemplate size={14} /> Theme Style
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button
                                        onClick={() => setTheme('neobrutalism')}
                                        style={{ padding: '12px', background: theme === 'neobrutalism' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: theme === 'neobrutalism' ? '#000' : 'var(--text-primary)', border: theme === 'neobrutalism' ? '2px solid #000' : '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                                    >NeoBrutalism</button>
                                    <button
                                        onClick={() => setTheme('glass')}
                                        style={{ padding: '12px', background: theme === 'glass' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: theme === 'glass' ? '#000' : 'var(--text-primary)', border: theme === 'glass' ? '2px solid #000' : '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                                    >Glass UI</button>
                                </div>
                            </div>

                            {/* Typography */}
                            <div>
                                <label className="auth-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Type size={14} /> Typography
                                </label>
                                <select
                                    value={fontFamily}
                                    onChange={(e) => setFontFamily(e.target.value as any)}
                                    className="auth-input"
                                    style={{ width: '100%', padding: '12px' }}
                                >
                                    <option value="inter">Inter (Clean & Modern)</option>
                                    <option value="outfit">Outfit (Geometric & Bold)</option>
                                    <option value="space-grotesk">Space Grotesk (Quirky)</option>
                                    <option value="fira-code">Fira Code (Developer)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Your Interests</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Pick a few tags so we can recommend guilds.</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
                            {tags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    style={{
                                        padding: '8px 16px',
                                        background: activeTags.includes(tag) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        border: `1px solid ${activeTags.includes(tag) ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                        color: activeTags.includes(tag) ? 'white' : 'var(--text-secondary)',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        transition: 'all 0.2s ease',
                                        fontWeight: activeTags.includes(tag) ? 600 : 500
                                    }}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 6 && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', background: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Check size={40} color="white" />
                        </div>
                        <h1 className="auth-heading">You're all set!</h1>
                        <p className="auth-subtext">Dive into Gratonite and start exploring.</p>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Back</button>
                    ) : <div></div>}

                    <button
                        className="auth-button"
                        onClick={handleNext}
                        disabled={saving}
                        style={{ width: 'auto', padding: '0 32px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? (
                            <>Saving... <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></>
                        ) : (
                            <>{step === 6 ? 'Done' : 'Next'} {step < 6 && <ChevronRight size={16} />}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
