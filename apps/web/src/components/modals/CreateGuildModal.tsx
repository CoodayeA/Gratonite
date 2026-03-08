import { useState, useRef, useEffect } from 'react';
import { Camera, X, Compass, Users, BookOpen, Music, Briefcase, Gamepad2, Coffee } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

type Template = {
    id: string;
    name: string;
    icon: React.ReactNode;
    emoji: string;
    defaultName: string;
    defaultDesc: string;
    channels: string[];
    isImport?: boolean;
    importSource?: string;
};

const templates: Template[] = [
    {
        id: 'gaming', name: 'Gaming Community', icon: <Gamepad2 size={14} />, emoji: '🎮',
        defaultName: 'Gaming Portal', defaultDesc: 'A place for gamers to hang out, organize events, and share clips.',
        channels: ['general', 'lfg', 'clips', 'events'],
    },
    {
        id: 'friends', name: 'Friends & Family', icon: <Users size={14} />, emoji: '👥',
        defaultName: 'My Crew', defaultDesc: 'A private space for friends and family to stay connected.',
        channels: ['general', 'photos', 'plans'],
    },
    {
        id: 'study', name: 'Study Group', icon: <BookOpen size={14} />, emoji: '📚',
        defaultName: 'Study Portal', defaultDesc: 'Focus together, share resources, and ace your goals.',
        channels: ['general', 'resources', 'homework-help', 'accountability'],
    },
    {
        id: 'creative', name: 'Creative Studio', icon: <Compass size={14} />, emoji: '🎨',
        defaultName: 'Creative Hub', defaultDesc: 'Share art, music, writing, and collaborate on creative projects.',
        channels: ['gallery', 'feedback', 'wips', 'inspiration'],
    },
    {
        id: 'music', name: 'Music Community', icon: <Music size={14} />, emoji: '🎵',
        defaultName: 'Music Portal', defaultDesc: 'Share tracks, discuss music theory, and find collaborators.',
        channels: ['general', 'share-your-music', 'production', 'gear'],
    },
    {
        id: 'business', name: 'Business & Networking', icon: <Briefcase size={14} />, emoji: '💼',
        defaultName: 'Network Portal', defaultDesc: 'Connect with professionals, share opportunities, and grow together.',
        channels: ['general', 'opportunities', 'showcase', 'feedback'],
    },
    {
        id: 'chill', name: 'Chill Hangout', icon: <Coffee size={14} />, emoji: '☕',
        defaultName: 'Hang Zone', defaultDesc: 'A laid-back space to just vibe, chat, and relax.',
        channels: ['general', 'memes', 'music', 'venting'],
    },
];

const CreateGuildModal = ({ onClose, onGuildCreated }: { onClose: () => void; onGuildCreated?: (guild: { id: string; name: string; iconHash: string | null }) => void }) => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [step, setStep] = useState<'template' | 'details' | 'import' | 'from-template'>('template');
    const [templateCode, setTemplateCode] = useState('');
    const [templateCreating, setTemplateCreating] = useState(false);
    const [guildName, setGuildName] = useState('My Portal');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [importProgress, setImportProgress] = useState(0);
    const [importing, setImporting] = useState(false);
    const [creating, setCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setIconUrl(url);
            setIconFile(file);
            addToast({ title: 'Icon uploaded', variant: 'info' });
        }
    };

    const selectTemplate = (t: Template) => {
        setSelectedTemplate(t);
        setGuildName(t.defaultName);
        setDescription(t.defaultDesc);
        if (t.isImport) {
            setStep('import');
        } else {
            setStep('details');
        }
    };

    const handleImport = () => {
        setImporting(true);
        let p = 0;
        const iv = setInterval(() => {
            p += Math.random() * 25;
            if (p >= 100) {
                p = 100;
                clearInterval(iv);
                setTimeout(() => {
                    setImporting(false);
                    setStep('details');
                }, 400);
            }
            setImportProgress(Math.min(p, 100));
        }, 300);
    };

    const handleCreate = async () => {
        if (!guildName.trim() || creating) return;
        setCreating(true);
        try {
            const toChannelSlug = (value: string) =>
                value
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');

            // 1. Create the guild via API
            const guild = await api.guilds.create({
                name: guildName.trim(),
                description: description.trim() || undefined,
                isDiscoverable: isPublic,
            });

            // 2. Upload icon if provided
            if (iconFile) {
                try {
                    await api.guilds.uploadIcon(guild.id, iconFile);
                } catch { /* icon upload is non-critical */ }
            }

            // 3. Create default channels based on template
            const channelNames = selectedTemplate?.channels || ['general'];
            // Create a "Text Channels" category
            let textCategoryId: string | undefined;
            try {
                const textCat = await api.channels.create(guild.id, { name: 'text-channels', type: 'GUILD_CATEGORY' });
                textCategoryId = textCat.id;
            } catch { /* category creation might not be supported */ }

            // Create text channels
            for (let i = 0; i < channelNames.length; i++) {
                try {
                    const channelName = toChannelSlug(channelNames[i]);
                    if (!channelName) continue;
                    await api.channels.create(guild.id, {
                        name: channelName,
                        type: 'GUILD_TEXT',
                        parentId: textCategoryId,
                    });
                } catch { /* continue creating other channels */ }
            }

            // Create a "Voice Channels" category and a default voice channel
            let voiceCategoryId: string | undefined;
            try {
                const voiceCat = await api.channels.create(guild.id, { name: 'voice-channels', type: 'GUILD_CATEGORY' });
                voiceCategoryId = voiceCat.id;
            } catch { /* category creation might not be supported */ }

            try {
                await api.channels.create(guild.id, {
                    name: 'general',
                    type: 'GUILD_VOICE',
                    parentId: voiceCategoryId,
                });
            } catch { /* voice channel creation might fail */ }

            addToast({
                title: 'Portal Created!',
                description: `Welcome to ${guildName}`,
                variant: 'success'
            });

            onGuildCreated?.({ id: guild.id, name: guild.name, iconHash: guild.iconHash ?? null });
            onClose();
            // Navigate to the new guild
            navigate(`/guild/${guild.id}`);
        } catch (err: any) {
            const isDuplicate = err?.status === 409 || err?.message?.includes('already exists');
            addToast({
                title: isDuplicate ? 'Name Already Taken' : 'Failed to create portal',
                description: isDuplicate ? 'A portal with this name already exists. Please choose a different name.' : (err?.message || 'Something went wrong.'),
                variant: 'error'
            });
        } finally {
            setCreating(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div style={{ width: step === 'template' ? '560px' : '500px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--stroke)', position: 'relative', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                {/* ── Step 1: Template picker ── */}
                {step === 'template' && (
                    <>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '6px', textAlign: 'center' }}>Create Your Portal</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>Choose a template to get started, or start from scratch.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                            {templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => selectTemplate(t)}
                                    style={{
                                        padding: '14px 12px',
                                        borderRadius: '10px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        textAlign: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(82, 109, 245, 0.12)';
                                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-tertiary)';
                                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--stroke)';
                                    }}
                                >
                                    <span style={{ fontSize: '22px' }}>{t.emoji}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px' }}>{t.icon}</div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{t.name}</span>
                                </div>
                            ))}

                            {/* Start from scratch */}
                            <div
                                onClick={() => { setSelectedTemplate(null); setGuildName('My Portal'); setDescription(''); setStep('details'); }}
                                style={{
                                    padding: '14px 12px', borderRadius: '10px',
                                    background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)',
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '8px', textAlign: 'center', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--stroke)'; }}
                            >
                                <span style={{ fontSize: '22px' }}>✨</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Start from Scratch</span>
                            </div>

                            {/* Use a Template Code */}
                            <div
                                onClick={() => setStep('from-template')}
                                style={{
                                    padding: '14px 12px', borderRadius: '10px',
                                    background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)',
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: '8px', textAlign: 'center', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-primary)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--stroke)'; }}
                            >
                                <span style={{ fontSize: '22px' }}>📋</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Use a Template</span>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Step 2: Import wizard ── */}
                {step === 'import' && selectedTemplate?.isImport && (
                    <>
                        <button onClick={() => setStep('template')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>← Back</button>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '6px', textAlign: 'center' }}>
                            Import from {selectedTemplate.importSource}
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px', textAlign: 'center' }}>
                            We'll import your channels, roles, and members. Messages are not imported.
                        </p>

                        {!importing && importProgress === 0 && (
                            <>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', marginBottom: '24px', border: '1px solid var(--stroke)' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>What gets imported</div>
                                    {['Server name & icon', 'Text & voice channels', 'Roles & permissions', 'Emoji & stickers', 'Members (who consent)'].map(item => (
                                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                            <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> {item}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                                        {selectedTemplate.importSource} Server ID or Invite Link
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={`Paste your ${selectedTemplate.importSource} invite link...`}
                                        style={{ width: '100%', height: '44px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 16px', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <button onClick={handleImport} style={{ width: '100%', height: '44px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', color: '#000', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                                    Start Import
                                </button>
                            </>
                        )}

                        {(importing || importProgress > 0) && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚡</div>
                                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>Importing your server...</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>This usually takes under 30 seconds.</p>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '100px', height: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                                    <div style={{ height: '100%', width: `${importProgress}%`, background: 'var(--accent-primary)', borderRadius: '100px', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{Math.round(importProgress)}%</span>
                            </div>
                        )}
                    </>
                )}

                {/* ── Step: Use a Template Code ── */}
                {step === 'from-template' && (
                    <>
                        <button onClick={() => setStep('template')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>← Back</button>
                        <h1 style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '6px', textAlign: 'center' }}>Use a Template</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>Enter a template code to create a portal from an existing template.</p>

                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Template Code</label>
                        <input
                            type="text"
                            value={templateCode}
                            onChange={(e) => setTemplateCode(e.target.value)}
                            placeholder="Paste template code here..."
                            style={{ width: '100%', height: '44px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 16px', fontSize: '14px', outline: 'none', marginBottom: '24px' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                            <button
                                onClick={async () => {
                                    if (!templateCode.trim() || templateCreating) return;
                                    setTemplateCreating(true);
                                    try {
                                        const guild = await api.guilds.createFromTemplate(templateCode.trim());
                                        addToast({ title: 'Portal Created from Template!', variant: 'success' });
                                        onGuildCreated?.({ id: guild.id, name: guild.name, iconHash: guild.iconHash ?? null });
                                        onClose();
                                        navigate(`/guild/${guild.id}`);
                                    } catch (err: any) {
                                        addToast({ title: 'Failed to create from template', description: err?.message || 'Invalid template code.', variant: 'error' });
                                    } finally {
                                        setTemplateCreating(false);
                                    }
                                }}
                                disabled={!templateCode.trim() || templateCreating}
                                style={{ height: '44px', padding: '0 24px', borderRadius: 'var(--radius-sm)', background: templateCode.trim() && !templateCreating ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: templateCode.trim() && !templateCreating ? '#000' : 'var(--text-muted)', border: 'none', fontSize: '14px', fontWeight: 600, cursor: templateCode.trim() && !templateCreating ? 'pointer' : 'default', transition: 'all 0.2s' }}
                            >
                                {templateCreating ? 'Creating...' : 'Create from Template'}
                            </button>
                        </div>
                    </>
                )}

                {/* ── Step 3: Portal details ── */}
                {step === 'details' && (
                    <>
                        {selectedTemplate && (
                            <button onClick={() => setStep('template')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>← Back</button>
                        )}

                        <h1 style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '6px', textAlign: 'center' }}>
                            {selectedTemplate ? `${selectedTemplate.emoji} ${selectedTemplate.name}` : 'Create Your Portal'}
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>Customize your portal before creating it.</p>

                        {/* Icon upload */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/mp4,video/webm,image/gif" onChange={handleFileChange} />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{ width: '80px', height: '80px', borderRadius: '50%', background: iconUrl ? `url(${iconUrl}) center/cover` : 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px', overflow: 'hidden' }}
                            >
                                {!iconUrl && <Camera size={24} color="var(--text-muted)" />}
                            </div>
                            <span onClick={() => fileInputRef.current?.click()} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{iconUrl ? 'Change Icon' : 'Upload Icon'}</span>
                        </div>

                        {/* Default channels preview */}
                        {selectedTemplate && (
                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', border: '1px solid var(--stroke)' }}>
                                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Pre-built Channels</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {selectedTemplate.channels.map(ch => (
                                        <span key={ch} style={{ fontSize: '12px', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: '6px', color: 'var(--text-secondary)' }}>#{ch}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Portal Name</label>
                        <input
                            type="text"
                            value={guildName}
                            onChange={(e) => setGuildName(e.target.value)}
                            style={{ width: '100%', height: '44px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0 16px', fontSize: '14px', outline: 'none', marginBottom: '16px' }}
                        />

                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={{ width: '100%', height: '80px', resize: 'none', marginBottom: '20px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '12px 16px', fontSize: '14px', outline: 'none' }}
                            placeholder="What is this portal about?"
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Public Portal</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Anyone can discover and join</div>
                            </div>
                            <div onClick={() => setIsPublic(!isPublic)} style={{ width: '40px', height: '20px', background: isPublic ? 'var(--accent-primary)' : 'var(--bg-tertiary)', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                                <div style={{ width: '16px', height: '16px', background: isPublic ? '#111' : 'var(--text-muted)', borderRadius: '50%', position: 'absolute', top: '2px', left: isPublic ? '22px' : '2px', transition: 'left 0.2s' }} />
                            </div>
                        </div>

                        <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '24px' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                            <button
                                onClick={handleCreate}
                                disabled={!guildName.trim() || creating}
                                style={{ height: '44px', padding: '0 24px', borderRadius: 'var(--radius-sm)', background: guildName.trim() && !creating ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: guildName.trim() && !creating ? '#000' : 'var(--text-muted)', border: 'none', fontSize: '14px', fontWeight: 600, cursor: guildName.trim() && !creating ? 'pointer' : 'default', transition: 'all 0.2s' }}
                            >
                                {creating ? 'Creating...' : 'Create Portal'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CreateGuildModal;
