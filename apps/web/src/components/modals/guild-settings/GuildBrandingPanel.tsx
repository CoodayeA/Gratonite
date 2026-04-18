import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Check, Save, Image } from 'lucide-react';
import { api, API_BASE } from '../../../lib/api';

type AddToastFn = (t: { title: string; description?: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void;

interface GuildBrandingPanelProps {
    guildId: string;
    guild: any;
    addToast: AddToastFn;
    onGuildUpdate: (partial: Record<string, unknown>) => void;
}

const ACCENT_COLORS = [
    { color: '#526df5', name: 'Gratonite Blue' },
    { color: '#8b5cf6', name: 'Purple' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#10b981', name: 'Green' },
    { color: '#f59e0b', name: 'Amber' },
    { color: '#ef4444', name: 'Red' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#84cc16', name: 'Lime' },
    { color: '#f97316', name: 'Orange' },
    { color: '#64748b', name: 'Slate' },
];

function GuildBrandingPanel({ guildId, guild, addToast, onGuildUpdate }: GuildBrandingPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Banner state
    const [bannerPreview, setBannerPreview] = useState<string>(() => {
        if (guild?.bannerHash) return `${API_BASE}/files/${guild.bannerHash}`;
        return '';
    });
    const [bannerIsVideo, setBannerIsVideo] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // Accent color state
    const [selectedColor, setSelectedColor] = useState<string>(() => guild?.accentColor || '#526df5');
    const [colorSaved, setColorSaved] = useState(false);
    const [colorSaving, setColorSaving] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep in sync if guild prop changes
    useEffect(() => {
        if (guild?.bannerHash) {
            const url = `${API_BASE}/files/${guild.bannerHash}`;
            setBannerPreview(url);
            setBannerIsVideo(url.endsWith('.mp4') || url.endsWith('.webm'));
        } else {
            setBannerPreview('');
        }
        if (guild?.accentColor) setSelectedColor(guild.accentColor);
    }, [guild?.bannerHash, guild?.accentColor]);

    const handleFileSelect = (file: File) => {
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            addToast({ title: 'File too large', description: 'Banner must be under 10 MB.', variant: 'error' });
            return;
        }
        const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
        if (!allowed.includes(file.type)) {
            addToast({ title: 'Invalid file type', description: 'Only PNG, JPG, GIF, WebP, MP4, or WebM allowed.', variant: 'error' });
            return;
        }
        const url = URL.createObjectURL(file);
        setBannerPreview(url);
        setBannerIsVideo(file.type.startsWith('video/'));
        setPendingFile(file);
    };

    const handleUpload = async () => {
        if (!pendingFile) return;
        setUploading(true);
        try {
            const result = await api.guilds.uploadBanner(guildId, pendingFile);
            const newUrl = `${API_BASE}/files/${result.bannerHash}`;
            setBannerPreview(newUrl);
            setBannerIsVideo(result.bannerAnimated && (pendingFile.type.startsWith('video/')));
            setPendingFile(null);
            onGuildUpdate({ bannerHash: result.bannerHash });
            addToast({ title: 'Banner updated!', variant: 'success' });
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId } }));
        } catch (err: any) {
            addToast({ title: 'Failed to upload banner', description: err?.message || 'Unknown error', variant: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveBanner = async () => {
        if (pendingFile) {
            setPendingFile(null);
            if (guild?.bannerHash) {
                setBannerPreview(`${API_BASE}/files/${guild.bannerHash}`);
            } else {
                setBannerPreview('');
            }
            return;
        }
        setUploading(true);
        try {
            await api.guilds.deleteBanner(guildId);
            setBannerPreview('');
            setBannerIsVideo(false);
            onGuildUpdate({ bannerHash: null });
            addToast({ title: 'Banner removed', variant: 'success' });
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId } }));
        } catch (err: any) {
            addToast({ title: 'Failed to remove banner', description: err?.message || 'Unknown error', variant: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const handleColorSelect = useCallback((color: string) => {
        setSelectedColor(color);
        setColorSaved(false);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setColorSaving(true);
            try {
                await api.guilds.update(guildId, { accentColor: color });
                onGuildUpdate({ accentColor: color });
                setColorSaved(true);
                window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId } }));
                setTimeout(() => setColorSaved(false), 2500);
            } catch {
                addToast({ title: 'Failed to save accent color', variant: 'error' });
            } finally {
                setColorSaving(false);
            }
        }, 800);
    }, [guildId, addToast, onGuildUpdate]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    return (
        <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px' }}>Brand Identity</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 32px' }}>
                Customize the visual appearance of your server.
            </p>

            {/* Banner Section */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', margin: '0 0 16px' }}>Guild Banner</h3>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    {/* Preview */}
                    <div style={{ position: 'relative', width: '300px', height: '130px', borderRadius: '10px', background: bannerPreview ? 'transparent' : 'linear-gradient(135deg, rgba(82,109,245,0.25), rgba(0,0,0,0.5))', border: '1px solid var(--stroke)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                        {bannerPreview ? (
                            bannerIsVideo
                                ? <video src={bannerPreview} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <img src={bannerPreview} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
                                <Image size={28} style={{ opacity: 0.4 }} />
                                <span style={{ fontSize: '12px' }}>Click to upload banner</span>
                            </div>
                        )}

                        {/* Upload overlay while uploading */}
                        {uploading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                                <div style={{ textAlign: 'center', color: 'white' }}>
                                    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                                    <span style={{ fontSize: '12px' }}>Uploading...</span>
                                </div>
                            </div>
                        )}

                        {/* Pending badge */}
                        {pendingFile && !uploading && (
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#f59e0b', color: '#000', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                                Unsaved
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                            Recommended: at least 960×540. Supports PNG, JPG, GIF, WebP, or MP4 video under 10 MB.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: uploading ? 'wait' : 'pointer', fontWeight: 600, fontSize: '13px' }}
                            >
                                <Upload size={13} /> {pendingFile ? 'Change File' : 'Upload Banner'}
                            </button>
                            {pendingFile && !uploading && (
                                <button
                                    onClick={handleUpload}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                >
                                    <Save size={13} /> Save Banner
                                </button>
                            )}
                            {bannerPreview && !uploading && (
                                <button
                                    onClick={handleRemoveBanner}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                >
                                    <X size={13} /> {pendingFile ? 'Discard' : 'Remove'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Accent Color Section */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', margin: 0 }}>Accent Color</h3>
                    {colorSaving && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saving…</span>}
                    {colorSaved && !colorSaving && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                            <Check size={13} /> Saved
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    Used for buttons, links, and highlights across your server.
                </p>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {ACCENT_COLORS.map(ac => (
                        <button
                            key={ac.color}
                            onClick={() => handleColorSelect(ac.color)}
                            title={ac.name}
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%', background: ac.color,
                                border: selectedColor === ac.color ? '3px solid white' : '3px solid transparent',
                                boxShadow: selectedColor === ac.color ? `0 0 0 2px ${ac.color}` : 'none',
                                cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, padding: 0,
                            }}
                        />
                    ))}
                </div>

                {/* Custom color input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                        type="color"
                        value={selectedColor}
                        onChange={e => handleColorSelect(e.target.value)}
                        style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'none', cursor: 'pointer', padding: '2px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Custom color</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '6px' }}>{selectedColor}</span>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
            />

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

export default GuildBrandingPanel;
