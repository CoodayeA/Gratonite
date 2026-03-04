import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bot, ArrowLeft, Upload, Check, X, Send, Shield,
    Settings, Terminal, Eye, Plus, Trash2, Info, Webhook,
    Copy, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type BotCommand = { name: string; description: string; response: string };
type BotPermission = { id: string; label: string; enabled: boolean };
type BotTab = 'native' | 'webhook';

// Backend-aligned category enum values
type BotCategoryValue = 'fun' | 'moderation' | 'music' | 'utility' | 'social' | 'gaming' | 'other';
type BotCategoryOption = { value: BotCategoryValue; label: string };

const CATEGORIES: BotCategoryOption[] = [
    { value: 'utility', label: 'Utility' },
    { value: 'moderation', label: 'Moderation' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'fun', label: 'Fun' },
    { value: 'social', label: 'Social' },
    { value: 'other', label: 'Other' },
];

interface WebhookBot {
    id: string;
    name: string;
    description: string | null;
    webhookUrl: string;
    isActive: boolean;
    createdAt: string;
}

// ─── Secret Reveal Modal ─────────────────────────────────────────────────────

const SecretRevealModal = ({ title, fields, onClose }: {
    title: string;
    fields: { label: string; value: string; warning: string }[];
    onClose: () => void;
}) => {
    const { addToast } = useToast();
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = (label: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(label);
            addToast({ title: 'Copied!', description: `${label} copied to clipboard.`, variant: 'success' });
            setTimeout(() => setCopiedField(null), 2000);
        }).catch(() => {
            addToast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'error' });
        });
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', padding: '32px', width: '500px', border: '1px solid var(--stroke)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        These credentials are shown <strong style={{ color: '#f59e0b' }}>only once</strong>. Copy and store them securely now. You will not be able to see them again.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {fields.map(field => (
                        <div key={field.label}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <code style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                                    {field.value}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(field.label, field.value)}
                                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--stroke)', background: copiedField === field.label ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', color: copiedField === field.label ? '#10b981' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                                >
                                    {copiedField === field.label ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onClose} style={{ marginTop: '24px', width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#111', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                    I've saved these credentials
                </button>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const BotBuilder = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    // Native bot state (existing)
    const [nativeTab, setNativeTab] = useState<'general' | 'commands' | 'permissions' | 'preview'>('general');
    const [botName, setBotName] = useState('My Bot');
    const [botDesc, setBotDesc] = useState('');
    const [botPrefix, setBotPrefix] = useState('!');
    const [botAvatar, setBotAvatar] = useState('🤖');
    const [botColor, setBotColor] = useState('#6366f1');
    const [botCategory, setBotCategory] = useState<BotCategoryValue>('utility');
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [commands, setCommands] = useState<BotCommand[]>([
        { name: 'help', description: 'Shows all available commands', response: 'Here are my commands: {commands}' },
        { name: 'ping', description: 'Check bot latency', response: 'Pong! Latency: {latency}ms' },
    ]);

    const [permissions, setPermissions] = useState<BotPermission[]>([
        { id: 'read', label: 'Read Messages', enabled: true },
        { id: 'send', label: 'Send Messages', enabled: true },
        { id: 'manage', label: 'Manage Messages', enabled: false },
        { id: 'kick', label: 'Kick Members', enabled: false },
        { id: 'ban', label: 'Ban Members', enabled: false },
        { id: 'roles', label: 'Manage Roles', enabled: false },
        { id: 'channels', label: 'Manage Channels', enabled: false },
        { id: 'webhooks', label: 'Manage Webhooks', enabled: false },
        { id: 'reactions', label: 'Add Reactions', enabled: true },
        { id: 'embed', label: 'Embed Links', enabled: true },
        { id: 'files', label: 'Attach Files', enabled: true },
        { id: 'voice', label: 'Connect to Voice', enabled: false },
    ]);

    const [newCmd, setNewCmd] = useState({ name: '', description: '', response: '' });

    // Webhook bot state
    const [mainTab, setMainTab] = useState<BotTab>('native');
    const [webhookBots, setWebhookBots] = useState<WebhookBot[]>([]);
    const [webhookBotsLoading, setWebhookBotsLoading] = useState(false);
    const [webhookForm, setWebhookForm] = useState({ name: '', description: '', webhookUrl: '' });
    const [webhookCreating, setWebhookCreating] = useState(false);
    const [revealModal, setRevealModal] = useState<{ title: string; fields: { label: string; value: string; warning: string }[] } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [rotatingId, setRotatingId] = useState<string | null>(null);
    const [selectedApplicationId, setSelectedApplicationId] = useState('');

    const avatarOptions = ['🤖', '🧠', '⚡', '🎮', '🎵', '🛡️', '📊', '🔧', '🌟', '🐾', '🎯', '🔮'];

    const getCategoryLabel = (value: BotCategoryValue): string => {
        return CATEGORIES.find(c => c.value === value)?.label ?? value;
    };

    // Load webhook bots when tab activates
    const loadWebhookBots = () => {
        setWebhookBotsLoading(true);
        api.botApplications.listMine()
            .then((data: any[]) => {
                setWebhookBots((Array.isArray(data) ? data : []).map((b: any): WebhookBot => ({
                    id: b.id,
                    name: b.name ?? 'Unnamed Bot',
                    description: b.description ?? null,
                    webhookUrl: b.webhookUrl ?? '',
                    isActive: b.isActive ?? true,
                    createdAt: b.createdAt ?? '',
                })));
            })
            .catch(() => {
                addToast({ title: 'Failed to load webhook bots', variant: 'error' });
            })
            .finally(() => setWebhookBotsLoading(false));
    };

    useEffect(() => {
        if (mainTab === 'webhook') {
            loadWebhookBots();
        }
    }, [mainTab]);

    // ── Native bot handlers ──────────────────────────────────────────────────

    const addCommand = () => {
        if (!newCmd.name.trim()) return;
        setCommands(prev => [...prev, { ...newCmd }]);
        setNewCmd({ name: '', description: '', response: '' });
        addToast({ title: 'Command Added', variant: 'success' });
    };

    const removeCommand = (idx: number) => {
        setCommands(prev => prev.filter((_, i) => i !== idx));
    };

    const togglePermission = (id: string) => {
        setPermissions(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    };

    const handleSubmit = async () => {
        const cleanName = botName.trim();
        const cleanDescription = botDesc.trim();

        if (!selectedApplicationId) {
            addToast({ title: 'Select a linked bot app', description: 'Choose a webhook application before submitting.', variant: 'error' });
            return;
        }
        if (!cleanDescription) {
            addToast({ title: 'Description required', description: 'Add a store description before submitting.', variant: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            // Keep the linked bot application metadata aligned with the listing.
            await api.botApplications.update(selectedApplicationId, {
                name: cleanName || 'Unnamed Bot',
                description: cleanDescription,
            });

            await api.botStore.createListing({
                applicationId: selectedApplicationId,
                name: cleanName || 'Unnamed Bot',
                shortDescription: cleanDescription.slice(0, 256),
                longDescription: cleanDescription,
                category: botCategory,
                tags: [getCategoryLabel(botCategory)],
            });

            setSubmitted(true);
            addToast({ title: 'Bot Submitted!', description: `"${cleanName || 'Unnamed Bot'}" is pending review.`, variant: 'success' });
        } catch {
            addToast({ title: 'Submission failed', variant: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Webhook bot handlers ─────────────────────────────────────────────────

    const handleCreateWebhookBot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!webhookForm.name.trim() || !webhookForm.webhookUrl.trim()) return;
        setWebhookCreating(true);
        try {
            const result = await api.botApplications.create({
                name: webhookForm.name.trim(),
                description: webhookForm.description.trim() || undefined,
                webhookUrl: webhookForm.webhookUrl.trim(),
            });

            // Show one-time reveal modal
            const revealFields: { label: string; value: string; warning: string }[] = [];
            if (result.webhookSecret) {
                revealFields.push({ label: 'Webhook Secret', value: result.webhookSecret, warning: 'Store this securely. Shown only once.' });
            }
            if (result.apiToken) {
                revealFields.push({ label: 'API Token', value: result.apiToken, warning: 'Store this securely. Shown only once.' });
            }

            if (revealFields.length > 0) {
                setRevealModal({ title: 'Bot Created — Save Your Credentials', fields: revealFields });
            } else {
                addToast({ title: 'Webhook Bot Created!', description: `"${webhookForm.name}" is now registered.`, variant: 'success' });
            }

            // Add to list
            setWebhookBots(prev => [{
                id: result.id,
                name: result.name ?? webhookForm.name,
                description: (result.description ?? webhookForm.description) || null,
                webhookUrl: result.webhookUrl ?? webhookForm.webhookUrl,
                isActive: result.isActive ?? true,
                createdAt: result.createdAt ?? new Date().toISOString(),
            }, ...prev]);
            if (!selectedApplicationId) {
                setSelectedApplicationId(result.id);
            }

            setWebhookForm({ name: '', description: '', webhookUrl: '' });
        } catch (err: any) {
            addToast({ title: 'Failed to create bot', description: err?.message ?? 'Please try again.', variant: 'error' });
        } finally {
            setWebhookCreating(false);
        }
    };

    const handleDeleteBot = async (bot: WebhookBot) => {
        if (!window.confirm(`Delete "${bot.name}"? This action cannot be undone.`)) return;
        setDeletingId(bot.id);
        try {
            await api.botApplications.delete(bot.id);
            setWebhookBots(prev => prev.filter(b => b.id !== bot.id));
            if (selectedApplicationId === bot.id) {
                setSelectedApplicationId('');
            }
            addToast({ title: 'Bot deleted', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Delete failed', description: err?.message ?? 'Could not delete bot.', variant: 'error' });
        } finally {
            setDeletingId(null);
        }
    };

    const handleRotateToken = async (bot: WebhookBot) => {
        setRotatingId(bot.id);
        try {
            const result = await api.botApplications.rotate(bot.id);
            setRevealModal({
                title: `New API Token for "${bot.name}"`,
                fields: [{ label: 'New API Token', value: result.apiToken, warning: 'This replaces your old token. Store it securely.' }],
            });
            addToast({ title: 'Token rotated', description: 'Your new API token is displayed below.', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Rotate failed', description: err?.message ?? 'Could not rotate token.', variant: 'error' });
        } finally {
            setRotatingId(null);
        }
    };

    // ─── Preview ─────────────────────────────────────────────────────────────

    const BotPreview = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bot card preview */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '14px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: `linear-gradient(135deg, ${botColor}, ${botColor}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>{botAvatar}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 700 }}>{botName || 'Unnamed Bot'}</span>
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600 }}>BOT</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{botDesc || 'No description yet'}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{getCategoryLabel(botCategory)}</span>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{commands.length} commands</span>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Prefix: {botPrefix}</span>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Preview only · Submit to publish in Bot Store</span>
                    <button disabled style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', cursor: 'not-allowed' }}>Preview Mode</button>
                </div>
            </div>

            {/* Command response preview */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '14px', border: '1px solid var(--stroke)', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Chat Preview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>M</div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>MeowByte</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Today at 3:42 PM</span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{botPrefix}help</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: botColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{botAvatar}</div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: botColor }}>{botName}</span>
                                <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: botColor + '33', color: botColor, fontWeight: 700 }}>BOT</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Today at 3:42 PM</span>
                            </div>
                            <div style={{ marginTop: '6px', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${botColor}`, background: 'var(--bg-tertiary)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Available Commands</div>
                                {commands.map(cmd => (
                                    <div key={cmd.name} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', gap: '6px' }}>
                                        <code style={{ color: botColor, fontWeight: 600 }}>{botPrefix}{cmd.name}</code>
                                        <span>— {cmd.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── Submit Modal ────────────────────────────────────────────────────────

    const SubmitModal = () => (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => !submitting && setShowSubmitModal(false)}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', padding: '32px', width: '420px', border: '1px solid var(--stroke)' }} onClick={e => e.stopPropagation()}>
                {submitted ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Check size={32} color="#10b981" />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Bot Submitted!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>"{botName}" is now under review. Typical approval takes 24–48 hours.</p>
                        <button
                            onClick={() => { setShowSubmitModal(false); setSubmitted(false); }}
                            style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#111', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={18} color="var(--accent-primary)" /> Submit to Bot Store
                            </h3>
                            <button onClick={() => setShowSubmitModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '14px', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: botColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>{botAvatar}</div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '15px' }}>{botName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{commands.length} commands · {getCategoryLabel(botCategory)} · Prefix: {botPrefix}</div>
                            </div>
                        </div>

                        <div style={{ padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Submissions must be linked to an existing webhook bot application so installs use a real application ID.
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Linked Bot Application</label>
                            {webhookBotsLoading ? (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading applications...</div>
                            ) : webhookBots.length === 0 ? (
                                <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Create a webhook bot in the Webhook Bot tab before submitting.
                                </div>
                            ) : (
                                <select
                                    value={selectedApplicationId}
                                    onChange={e => setSelectedApplicationId(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                >
                                    <option value="">Select a bot application...</option>
                                    {webhookBots
                                        .filter(bot => bot.isActive)
                                        .map(bot => (
                                            <option key={bot.id} value={bot.id}>
                                                {bot.name}
                                            </option>
                                        ))}
                                </select>
                            )}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Store Description</label>
                            <textarea
                                value={botDesc}
                                onChange={e => setBotDesc(e.target.value)}
                                placeholder="Describe what your bot does and why people should add it..."
                                rows={3}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <Shield size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                All bot submissions are reviewed for security and quality. Bots that request excessive permissions may be flagged.
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowSubmitModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={!botName.trim() || commands.length === 0 || !botDesc.trim() || !selectedApplicationId}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: botName.trim() && commands.length > 0 && botDesc.trim() && selectedApplicationId ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: botName.trim() && commands.length > 0 && botDesc.trim() && selectedApplicationId ? '#111' : 'var(--text-muted)', fontWeight: 700, cursor: botName.trim() && commands.length > 0 && botDesc.trim() && selectedApplicationId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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

    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            {showSubmitModal && <SubmitModal />}
            {revealModal && (
                <SecretRevealModal
                    title={revealModal.title}
                    fields={revealModal.fields}
                    onClose={() => setRevealModal(null)}
                />
            )}

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
                    <button onClick={() => navigate('/discover')} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Bot size={24} color="var(--accent-primary)" /> Bot Builder
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Create, configure, and publish your own bot</p>
                    </div>
                    {mainTab === 'native' && (
                        <button onClick={() => { loadWebhookBots(); setShowSubmitModal(true); }} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#111', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Upload size={14} /> Submit to Store
                        </button>
                    )}
                </div>

                {/* Main Tab selector (Native / Webhook) */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--stroke)', width: 'fit-content' }}>
                    {([
                        { key: 'native', label: 'Native Bot', icon: <Bot size={14} /> },
                        { key: 'webhook', label: 'Webhook Bot', icon: <Webhook size={14} /> },
                    ] as { key: BotTab; label: string; icon: React.ReactNode }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setMainTab(t.key)}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontWeight: mainTab === t.key ? 700 : 400, fontSize: '13px',
                                background: mainTab === t.key ? 'var(--accent-primary)' : 'transparent',
                                color: mainTab === t.key ? '#111' : 'var(--text-secondary)', transition: 'all 0.2s'
                            }}
                        >{t.icon} {t.label}</button>
                    ))}
                </div>

                {/* ── Native Bot Section ── */}
                {mainTab === 'native' && (
                    <>
                        {/* Native sub-tabs */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                            {([
                                { key: 'general', label: 'General', icon: <Settings size={14} /> },
                                { key: 'commands', label: 'Commands', icon: <Terminal size={14} /> },
                                { key: 'permissions', label: 'Permissions', icon: <Shield size={14} /> },
                                { key: 'preview', label: 'Preview', icon: <Eye size={14} /> },
                            ] as { key: typeof nativeTab; label: string; icon: React.ReactNode }[]).map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setNativeTab(t.key)}
                                    style={{
                                        flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        fontWeight: nativeTab === t.key ? 700 : 400, fontSize: '13px',
                                        background: nativeTab === t.key ? 'var(--accent-primary)' : 'transparent',
                                        color: nativeTab === t.key ? '#111' : 'var(--text-secondary)', transition: 'all 0.2s'
                                    }}
                                >{t.icon} {t.label}</button>
                            ))}
                        </div>

                        {/* ── General Tab ── */}
                        {nativeTab === 'general' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>Bot Name</label>
                                        <input type="text" value={botName} onChange={e => setBotName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>Description</label>
                                        <textarea value={botDesc} onChange={e => setBotDesc(e.target.value)} placeholder="What does your bot do?" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>Prefix</label>
                                            <input type="text" value={botPrefix} onChange={e => setBotPrefix(e.target.value.slice(0, 3))} maxLength={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '16px', outline: 'none', fontFamily: 'monospace', textAlign: 'center', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>Accent Color</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={botColor} onChange={e => setBotColor(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: 0 }} />
                                                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>{botColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'block' }}>Avatar</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {avatarOptions.map(a => (
                                                <button key={a} onClick={() => setBotAvatar(a)} style={{ width: '44px', height: '44px', borderRadius: '10px', border: botAvatar === a ? `2px solid ${botColor}` : '2px solid var(--stroke)', background: botAvatar === a ? botColor + '22' : 'var(--bg-tertiary)', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>{a}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'block' }}>Category</label>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {CATEGORIES.map(c => (
                                                <button key={c.value} onClick={() => setBotCategory(c.value)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--stroke)', background: botCategory === c.value ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: botCategory === c.value ? '#111' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>{c.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Commands Tab ── */}
                        {nativeTab === 'commands' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        Commands defined here will be registered as slash commands when you submit your bot.
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Commands ({commands.length})</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {commands.map((cmd, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)' }}>
                                                <code style={{ color: botColor, fontWeight: 700, fontSize: '13px', minWidth: '80px' }}>{botPrefix}{cmd.name}</code>
                                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{cmd.description}</span>
                                                <button onClick={() => removeCommand(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Add New Command</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                                        <input type="text" placeholder="Command name" value={newCmd.name} onChange={e => setNewCmd(p => ({ ...p, name: e.target.value.replace(/\s/g, '') }))} style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'monospace' }} />
                                        <input type="text" placeholder="Description" value={newCmd.description} onChange={e => setNewCmd(p => ({ ...p, description: e.target.value }))} style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                                    </div>
                                    <input type="text" placeholder="Response template (use {variable} for dynamic values)" value={newCmd.response} onChange={e => setNewCmd(p => ({ ...p, response: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />
                                    <button onClick={addCommand} disabled={!newCmd.name.trim()} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: newCmd.name.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: newCmd.name.trim() ? '#111' : 'var(--text-muted)', fontWeight: 700, fontSize: '13px', cursor: newCmd.name.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Plus size={14} /> Add Command
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Permissions Tab ── */}
                        {nativeTab === 'permissions' && (
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '20px', border: '1px solid var(--stroke)' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Select the permissions your bot needs. Only request what's necessary — bots requesting excessive permissions may be flagged during review.</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {permissions.map(p => (
                                        <div key={p.id} onClick={() => togglePermission(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: p.enabled ? 'rgba(16,185,129,0.08)' : 'var(--bg-tertiary)', border: p.enabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--stroke)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: p.enabled ? '#10b981' : 'transparent', border: p.enabled ? '2px solid #10b981' : '2px solid var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                                                {p.enabled && <Check size={12} color="#fff" />}
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: p.enabled ? 600 : 400, color: p.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {permissions.filter(p => p.enabled).length} permissions selected
                                </div>
                            </div>
                        )}

                        {/* ── Preview Tab ── */}
                        {nativeTab === 'preview' && <BotPreview />}
                    </>
                )}

                {/* ── Webhook Bot Section ── */}
                {mainTab === 'webhook' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Info banner */}
                        <div style={{ padding: '16px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <Webhook size={18} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Webhook bots receive events via HTTP POST to your endpoint. Register your bot, save the credentials, and start receiving events from Gratonite.
                            </div>
                        </div>

                        {/* Registration form */}
                        <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '20px', border: '1px solid var(--stroke)' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={16} /> Register New Webhook Bot
                            </h3>
                            <form onSubmit={handleCreateWebhookBot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Bot Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. My Awesome Bot"
                                        value={webhookForm.name}
                                        onChange={e => setWebhookForm(p => ({ ...p, name: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Description</label>
                                    <textarea
                                        placeholder="What does your bot do? (optional)"
                                        value={webhookForm.description}
                                        onChange={e => setWebhookForm(p => ({ ...p, description: e.target.value }))}
                                        rows={2}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Webhook URL *</label>
                                    <input
                                        type="url"
                                        required
                                        placeholder="https://your-server.com/webhook"
                                        value={webhookForm.webhookUrl}
                                        onChange={e => setWebhookForm(p => ({ ...p, webhookUrl: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={webhookCreating || !webhookForm.name.trim() || !webhookForm.webhookUrl.trim()}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: webhookCreating || !webhookForm.name.trim() || !webhookForm.webhookUrl.trim() ? 'var(--bg-tertiary)' : 'var(--accent-primary)', color: webhookCreating || !webhookForm.name.trim() || !webhookForm.webhookUrl.trim() ? 'var(--text-muted)' : '#111', fontWeight: 700, cursor: webhookCreating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}
                                >
                                    {webhookCreating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Webhook size={14} />}
                                    {webhookCreating ? 'Registering...' : 'Register Bot'}
                                </button>
                            </form>
                        </div>

                        {/* My webhook bots */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Your Webhook Bots</h3>
                                <button onClick={loadWebhookBots} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                    <RefreshCw size={12} /> Refresh
                                </button>
                            </div>

                            {webhookBotsLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: 'var(--text-muted)', gap: '10px' }}>
                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Loading bots...</span>
                                </div>
                            ) : webhookBots.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                                    <Webhook size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No webhook bots yet</p>
                                    <p style={{ fontSize: '12px' }}>Register your first webhook bot above to get started.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {webhookBots.map(bot => (
                                        <div key={bot.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Webhook size={20} color="#6366f1" />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{bot.name}</span>
                                                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: bot.isActive ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', color: bot.isActive ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                                                        {bot.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                                                    {bot.webhookUrl}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => handleRotateToken(bot)}
                                                    disabled={rotatingId === bot.id}
                                                    style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: rotatingId === bot.id ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {rotatingId === bot.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                                                    Rotate Token
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBot(bot)}
                                                    disabled={deletingId === bot.id}
                                                    style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--error)', cursor: deletingId === bot.id ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {deletingId === bot.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BotBuilder;
