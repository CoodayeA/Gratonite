import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Palette, Eye, Upload, ArrowLeft, Check, Copy,
    Type, Droplets, Square, LayoutGrid, Sparkles, Send, Star, X
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ThemeColors = {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgElevated: string;
    accentPrimary: string;
    accentHover: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    stroke: string;
    success: string;
    error: string;
    warning: string;
};

type ThemePreset = {
    name: string;
    colors: ThemeColors;
};

// ─── Presets ─────────────────────────────────────────────────────────────────

const presets: ThemePreset[] = [
    {
        name: 'Midnight Ocean',
        colors: { bgPrimary: '#0a0e1a', bgSecondary: '#111827', bgTertiary: '#1a2332', bgElevated: '#1f2937', accentPrimary: '#3b82f6', accentHover: '#2563eb', textPrimary: '#f1f5f9', textSecondary: '#94a3b8', textMuted: '#475569', stroke: 'rgba(255,255,255,0.08)', success: '#10b981', error: '#ef4444', warning: '#f59e0b' }
    },
    {
        name: 'Sakura Dream',
        colors: { bgPrimary: '#1a0a14', bgSecondary: '#251018', bgTertiary: '#33151f', bgElevated: '#3d1a26', accentPrimary: '#f472b6', accentHover: '#ec4899', textPrimary: '#fce7f3', textSecondary: '#f9a8d4', textMuted: '#9d174d', stroke: 'rgba(244,114,182,0.15)', success: '#34d399', error: '#fb7185', warning: '#fbbf24' }
    },
    {
        name: 'Emerald Matrix',
        colors: { bgPrimary: '#021a0a', bgSecondary: '#042f12', bgTertiary: '#064e1e', bgElevated: '#065f26', accentPrimary: '#22c55e', accentHover: '#16a34a', textPrimary: '#dcfce7', textSecondary: '#86efac', textMuted: '#166534', stroke: 'rgba(34,197,94,0.15)', success: '#22c55e', error: '#f87171', warning: '#facc15' }
    },
    {
        name: 'Warm Sunset',
        colors: { bgPrimary: '#1c1008', bgSecondary: '#2a1a0c', bgTertiary: '#382310', bgElevated: '#452c14', accentPrimary: '#f59e0b', accentHover: '#d97706', textPrimary: '#fef3c7', textSecondary: '#fcd34d', textMuted: '#92400e', stroke: 'rgba(245,158,11,0.15)', success: '#34d399', error: '#f87171', warning: '#f59e0b' }
    },
    {
        name: 'Cotton Candy',
        colors: { bgPrimary: '#fdf2f8', bgSecondary: '#fce7f3', bgTertiary: '#fbcfe8', bgElevated: '#ffffff', accentPrimary: '#a855f7', accentHover: '#9333ea', textPrimary: '#1e1b4b', textSecondary: '#6b21a8', textMuted: '#c084fc', stroke: 'rgba(168,85,247,0.2)', success: '#10b981', error: '#ef4444', warning: '#f59e0b' }
    },
];

// ─── Color Input ─────────────────────────────────────────────────────────────

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isRgba = value.startsWith('rgba');

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
                onClick={() => !isRgba && inputRef.current?.click()}
                style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: value, border: '2px solid var(--stroke)',
                    cursor: isRgba ? 'default' : 'pointer', flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)'
                }}
            />
            {!isRgba && (
                <input
                    ref={inputRef}
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px', color: 'var(--text-primary)' }}>{label}</div>
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    style={{
                        width: '100%', padding: '4px 8px', fontSize: '11px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        borderRadius: '6px', color: 'var(--text-secondary)', outline: 'none',
                        fontFamily: 'monospace', boxSizing: 'border-box'
                    }}
                />
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ThemeBuilder = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [themeName, setThemeName] = useState('My Custom Theme');
    const [themeDesc, setThemeDesc] = useState('');
    const [colors, setColors] = useState<ThemeColors>(presets[0].colors);
    const [activePanel, setActivePanel] = useState<'colors' | 'typography' | 'effects'>('colors');
    const [borderRadius, setBorderRadius] = useState(12);
    const [fontFamily, setFontFamily] = useState('Inter');
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [previewMode, setPreviewMode] = useState<'chat' | 'profile' | 'cards'>('chat');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const updateColor = (key: keyof ThemeColors, value: string) => {
        setColors(prev => ({ ...prev, [key]: value }));
    };

    const applyPreset = (preset: ThemePreset) => {
        setColors(preset.colors);
        setThemeName(preset.name);
        addToast({ title: `Preset "${preset.name}" loaded`, variant: 'info' });
    };

    const handleSubmit = async () => {
        if (!themeName.trim()) return;
        setSubmitting(true);
        try {
            // Build CSS vars record from ThemeColors
            const vars: Record<string, string> = {};
            Object.entries(colors).forEach(([key, val]) => {
                const prop = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                vars[`--${prop}`] = val;
            });
            vars['--radius-md'] = `${borderRadius}px`;
            vars['--font-primary'] = `'${fontFamily}', sans-serif`;

            // Step 1: Create the theme
            const theme = await api.themes.create({
                name: themeName.trim(),
                description: themeDesc.trim() || undefined,
                tags: selectedTags,
                vars,
            });

            // Step 2: Publish it (submit for store review)
            await api.themes.publish(theme.id);

            setSubmitting(false);
            setSubmitted(true);
            setTimeout(() => {
                setShowSubmitModal(false);
                setSubmitted(false);
                addToast({ title: 'Theme Submitted!', description: `"${themeName}" is now pending review. You'll be notified when it's approved.`, variant: 'success' });
            }, 1500);
        } catch (err: any) {
            setSubmitting(false);
            addToast({ title: 'Submission failed', description: err.message ?? 'Could not submit theme. Please try again.', variant: 'error' });
        }
    };

    const exportCSS = () => {
        const css = Object.entries(colors).map(([key, val]) => {
            const prop = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `  --${prop}: ${val};`;
        }).join('\n');
        navigator.clipboard.writeText(`:root {\n${css}\n  --radius-md: ${borderRadius}px;\n  --font-primary: '${fontFamily}', sans-serif;\n}`);
        addToast({ title: 'CSS Copied!', description: 'Theme variables copied to clipboard.', variant: 'success' });
    };

    // ─── Live Preview ────────────────────────────────────────────────────────

    const PreviewChat = () => (
        <div style={{ display: 'flex', height: '100%', borderRadius: `${borderRadius}px`, overflow: 'hidden', border: `1px solid ${colors.stroke}` }}>
            {/* Sidebar */}
            <div style={{ width: '56px', background: colors.bgTertiary, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: colors.accentPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff' }}>G</div>
                <div style={{ width: '28px', height: '1px', background: colors.stroke }} />
                {['A', 'N', 'D'].map(l => (
                    <div key={l} style={{ width: '36px', height: '36px', borderRadius: '50%', background: colors.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: colors.textSecondary }}>{l}</div>
                ))}
            </div>
            {/* Channel list */}
            <div style={{ width: '140px', background: colors.bgSecondary, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>General</div>
                <div style={{ padding: '6px 10px', borderRadius: `${Math.min(borderRadius, 8)}px`, background: colors.accentPrimary + '22', color: colors.accentPrimary, fontSize: '12px', fontWeight: 600 }}># chat</div>
                <div style={{ padding: '6px 10px', borderRadius: `${Math.min(borderRadius, 8)}px`, color: colors.textSecondary, fontSize: '12px' }}># announcements</div>
                <div style={{ padding: '6px 10px', borderRadius: `${Math.min(borderRadius, 8)}px`, color: colors.textMuted, fontSize: '12px' }}># off-topic</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, padding: '4px 8px', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Voice</div>
                <div style={{ padding: '6px 10px', borderRadius: `${Math.min(borderRadius, 8)}px`, color: colors.textSecondary, fontSize: '12px' }}>🔊 Lounge</div>
            </div>
            {/* Chat area */}
            <div style={{ flex: 1, background: colors.bgPrimary, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${colors.stroke}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary }}># chat</span>
                    <span style={{ fontSize: '11px', color: colors.textMuted }}>— General discussion</span>
                </div>
                {/* Messages */}
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                    {[
                        { user: 'S', color: '#8b5cf6', name: 'StarDust', msg: 'Hey everyone! Check out this new theme 🎨', time: '2:14 PM' },
                        { user: 'N', color: '#ec4899', name: 'NeonWave', msg: 'Looks amazing! Love the color palette', time: '2:15 PM' },
                        { user: 'P', color: '#06b6d4', name: 'PixelGhost', msg: 'The accent color really pops 🔥', time: '2:16 PM' },
                    ].map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.user}</div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: colors.textPrimary }}>{m.name}</span>
                                    <span style={{ fontSize: '10px', color: colors.textMuted }}>{m.time}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '2px' }}>{m.msg}</div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Input */}
                <div style={{ padding: '12px 16px' }}>
                    <div style={{ background: colors.bgTertiary, border: `1px solid ${colors.stroke}`, borderRadius: `${borderRadius}px`, padding: '10px 14px', fontSize: '13px', color: colors.textMuted }}>
                        Message #chat...
                    </div>
                </div>
            </div>
        </div>
    );

    const PreviewProfile = () => (
        <div style={{ background: colors.bgSecondary, borderRadius: `${borderRadius}px`, border: `1px solid ${colors.stroke}`, overflow: 'hidden' }}>
            <div style={{ height: '80px', background: `linear-gradient(135deg, ${colors.accentPrimary}, ${colors.accentHover})` }} />
            <div style={{ padding: '0 20px 20px', marginTop: '-28px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#8b5cf6', border: `4px solid ${colors.bgSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>M</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: colors.textPrimary }}>MeowByte</div>
                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '12px' }}>meowbyte#0001</div>
                <div style={{ height: '1px', background: colors.stroke, marginBottom: '12px' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>About Me</div>
                <div style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>Full-stack developer & theme creator. Building cool things with Gratonite.</div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                    {['🎨 Creator', '⭐ FAME'].map(badge => (
                        <span key={badge} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: colors.accentPrimary + '22', color: colors.accentPrimary, fontWeight: 600 }}>{badge}</span>
                    ))}
                </div>
            </div>
        </div>
    );

    const PreviewCards = () => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
                { title: 'Gratonite Balance', value: '12,450', sub: '+350 today', color: colors.accentPrimary },
                { title: 'FAME Received', value: '1,337', sub: '↑48 this week', color: colors.warning },
                { title: 'Items Owned', value: '24', sub: '3 Legendary', color: colors.success },
                { title: 'Global Rank', value: '#4', sub: '↑2 positions', color: colors.error },
            ].map(card => (
                <div key={card.title} style={{ background: colors.bgSecondary, borderRadius: `${borderRadius}px`, padding: '14px', border: `1px solid ${colors.stroke}`, borderTop: `3px solid ${card.color}` }}>
                    <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '6px' }}>{card.title}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>{card.value}</div>
                    <div style={{ fontSize: '11px', color: card.color, marginTop: '4px' }}>{card.sub}</div>
                </div>
            ))}
        </div>
    );

    // ─── Submit Modal ────────────────────────────────────────────────────────

    const SubmitModal = () => (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => !submitting && setShowSubmitModal(false)}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', padding: '32px', width: 'min(440px, 95vw)', border: '1px solid var(--stroke)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {submitted ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Check size={32} color="#10b981" />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Theme Submitted!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>"{themeName}" is now under review. You'll receive a notification once it's approved and live in the store.</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={18} color="var(--accent-primary)" /> Submit to Theme Store
                            </h3>
                            <button onClick={() => setShowSubmitModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        {/* Preview thumbnail */}
                        <div style={{ height: '120px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, background: colors.bgPrimary, display: 'flex' }}>
                                <div style={{ width: '30px', background: colors.bgTertiary }} />
                                <div style={{ width: '80px', background: colors.bgSecondary }} />
                                <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ height: '8px', width: '60%', background: colors.accentPrimary, borderRadius: '4px' }} />
                                    <div style={{ height: '6px', width: '80%', background: colors.textMuted + '44', borderRadius: '3px' }} />
                                    <div style={{ height: '6px', width: '50%', background: colors.textMuted + '33', borderRadius: '3px' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Theme Name</label>
                                <input
                                    type="text"
                                    value={themeName}
                                    onChange={e => setThemeName(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Description</label>
                                <textarea
                                    value={themeDesc}
                                    onChange={e => setThemeDesc(e.target.value)}
                                    placeholder="Describe your theme's mood and style..."
                                    rows={3}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Tags</label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {['Dark', 'Light', 'Neon', 'Minimal', 'Gradient', 'Pastel', 'Retro', 'Nature'].map(tag => (
                                        <span
                                            key={tag}
                                            onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                                            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: selectedTags.includes(tag) ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: `1px solid ${selectedTags.includes(tag) ? 'var(--accent-primary)' : 'var(--stroke)'}`, color: selectedTags.includes(tag) ? '#111' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: selectedTags.includes(tag) ? 700 : 400, transition: 'all 0.15s' }}
                                        >{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowSubmitModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={!themeName.trim() || submitting}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: themeName.trim() && !submitting ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: themeName.trim() && !submitting ? '#111' : 'var(--text-muted)', fontWeight: 700, cursor: themeName.trim() && !submitting ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                {submitting ? <span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>✦</span> : <><Send size={14} /> Submit for Review</>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // ─── Render ──────────────────────────────────────────────────────────────

    const colorGroups = [
        { label: 'Backgrounds', keys: ['bgPrimary', 'bgSecondary', 'bgTertiary', 'bgElevated'] as (keyof ThemeColors)[] },
        { label: 'Accent', keys: ['accentPrimary', 'accentHover'] as (keyof ThemeColors)[] },
        { label: 'Text', keys: ['textPrimary', 'textSecondary', 'textMuted'] as (keyof ThemeColors)[] },
        { label: 'Semantic', keys: ['success', 'error', 'warning'] as (keyof ThemeColors)[] },
        { label: 'Borders', keys: ['stroke'] as (keyof ThemeColors)[] },
    ];

    const friendlyNames: Record<string, string> = {
        bgPrimary: 'Primary BG', bgSecondary: 'Secondary BG', bgTertiary: 'Tertiary BG', bgElevated: 'Elevated BG',
        accentPrimary: 'Accent', accentHover: 'Accent Hover',
        textPrimary: 'Primary Text', textSecondary: 'Secondary Text', textMuted: 'Muted Text',
        success: 'Success', error: 'Error', warning: 'Warning', stroke: 'Border/Stroke'
    };

    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            {showSubmitModal && <SubmitModal />}

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                    <button onClick={() => navigate('/discover')} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Palette size={24} color="var(--accent-primary)" /> Theme Builder
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Design, preview, and publish your own custom theme</p>
                    </div>
                    <button onClick={exportCSS} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Copy size={14} /> Export CSS
                    </button>
                    <button onClick={() => setShowSubmitModal(true)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#111', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={14} /> Submit to Store
                    </button>
                </div>

                {/* Theme Name */}
                <div style={{ marginBottom: '24px' }}>
                    <input
                        type="text"
                        value={themeName}
                        onChange={e => setThemeName(e.target.value)}
                        style={{ fontSize: '20px', fontWeight: 700, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', borderBottom: '2px solid var(--stroke)', paddingBottom: '4px', width: '300px' }}
                    />
                </div>

                {/* Main layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
                    {/* Left: Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Presets */}
                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Presets</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {presets.map(p => (
                                    <button
                                        key={p.name}
                                        onClick={() => applyPreset(p)}
                                        style={{
                                            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                            background: themeName === p.name ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: themeName === p.name ? '#111' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s'
                                        }}
                                    >{p.name}</button>
                                ))}
                            </div>
                        </div>

                        {/* Panel tabs */}
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', borderRadius: '10px', padding: '4px', border: '1px solid var(--stroke)' }}>
                            {([
                                { key: 'colors', label: 'Colors', icon: <Droplets size={13} /> },
                                { key: 'typography', label: 'Type', icon: <Type size={13} /> },
                                { key: 'effects', label: 'Effects', icon: <Sparkles size={13} /> },
                            ] as { key: typeof activePanel; label: string; icon: React.ReactNode }[]).map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setActivePanel(t.key)}
                                    style={{
                                        flex: 1, padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                        fontWeight: activePanel === t.key ? 700 : 400, fontSize: '12px',
                                        background: activePanel === t.key ? 'var(--accent-primary)' : 'transparent',
                                        color: activePanel === t.key ? '#111' : 'var(--text-secondary)', transition: 'all 0.2s'
                                    }}
                                >{t.icon} {t.label}</button>
                            ))}
                        </div>

                        {/* Color controls */}
                        {activePanel === 'colors' && (
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '480px', overflowY: 'auto' }}>
                                {colorGroups.map(group => (
                                    <div key={group.label}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{group.label}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {group.keys.map(key => (
                                                <ColorField key={key} label={friendlyNames[key]} value={colors[key]} onChange={v => updateColor(key, v)} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Typography */}
                        {activePanel === 'typography' && (
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Font Family</div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {['Inter', 'JetBrains Mono', 'Space Grotesk', 'DM Sans', 'Outfit'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFontFamily(f)}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                                    background: fontFamily === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                    color: fontFamily === f ? '#111' : 'var(--text-secondary)',
                                                    cursor: 'pointer', fontSize: '12px', fontFamily: f, fontWeight: 600
                                                }}
                                            >{f}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Preview</div>
                                    <div style={{ fontFamily, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Heading Text</div>
                                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Body text looks like this with the selected font. How does it feel to read?</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Smaller caption text · 12px · muted</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Effects */}
                        {activePanel === 'effects' && (
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Border Radius</div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{borderRadius}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0} max={24} value={borderRadius}
                                        onChange={e => setBorderRadius(Number(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        <span>Sharp</span><span>Rounded</span>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Radius Preview</div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {[
                                            { label: 'Button', w: 80, h: 32 },
                                            { label: 'Card', w: 80, h: 60 },
                                            { label: 'Input', w: 120, h: 36 },
                                        ].map(s => (
                                            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: s.w, height: s.h, borderRadius: `${borderRadius}px`, background: colors.bgTertiary, border: `1px solid ${colors.stroke}` }} />
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Live Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Preview tabs */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '3px', border: '1px solid var(--stroke)' }}>
                                {([
                                    { key: 'chat', label: 'Chat View', icon: <LayoutGrid size={12} /> },
                                    { key: 'profile', label: 'Profile', icon: <Star size={12} /> },
                                    { key: 'cards', label: 'Cards', icon: <Square size={12} /> },
                                ] as { key: typeof previewMode; label: string; icon: React.ReactNode }[]).map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setPreviewMode(t.key)}
                                        style={{
                                            padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            fontWeight: previewMode === t.key ? 700 : 400, fontSize: '11px',
                                            background: previewMode === t.key ? 'var(--accent-primary)' : 'transparent',
                                            color: previewMode === t.key ? '#111' : 'var(--text-secondary)', transition: 'all 0.2s'
                                        }}
                                    >{t.icon} {t.label}</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <Eye size={14} /> Live Preview
                            </div>
                        </div>

                        {/* Preview panel */}
                        <div style={{
                            background: colors.bgPrimary, borderRadius: `${borderRadius}px`,
                            border: `1px solid ${colors.stroke}`, padding: previewMode === 'chat' ? 0 : '20px',
                            minHeight: '400px', overflow: 'hidden',
                            transition: 'all 0.3s'
                        }}>
                            {previewMode === 'chat' && <PreviewChat />}
                            {previewMode === 'profile' && <PreviewProfile />}
                            {previewMode === 'cards' && <PreviewCards />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeBuilder;
