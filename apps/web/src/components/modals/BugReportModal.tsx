import { useState, useEffect, useRef } from 'react';
import { X, Bug, Upload, CheckCircle, ImagePlus, Paperclip } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

type Category = 'bug' | 'ui' | 'crash' | 'other';

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
    { value: 'bug', label: 'Bug', emoji: '🐛' },
    { value: 'ui', label: 'Visual / UI', emoji: '🎨' },
    { value: 'crash', label: 'Crash', emoji: '💥' },
    { value: 'other', label: 'Other', emoji: '💬' },
];

const BugReportModal = ({ onClose }: { onClose: () => void }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Category>('bug');
    const [screenshots, setScreenshots] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
        setScreenshots(prev => [...prev, ...validFiles].slice(0, 5));
        e.target.value = '';
    };

    const removeScreenshot = (idx: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const attachmentUrls: string[] = [];
            for (const file of screenshots) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch(`${API_BASE}/files/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${getAccessToken() || ''}` },
                        body: formData,
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.hash || data.url) attachmentUrls.push(data.hash || data.url);
                    }
                } catch { /* skip failed uploads */ }
            }
            await api.bugReports.create({
                title: `[${category}] ${title}`,
                summary: description,
                pageUrl: window.location.href,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                userAgent: navigator.userAgent,
                clientTimestamp: new Date().toISOString(),
                ...(attachmentUrls.length > 0 ? { attachments: attachmentUrls } : {}),
            });
            const eventId = Sentry.captureMessage(`Bug Report: ${title}`, 'info');
            Sentry.captureFeedback({
                associatedEventId: eventId,
                message: description,
                name: title,
            });
            setIsSubmitting(false);
            setIsSubmitted(true);
            setTimeout(() => { onClose(); }, 2500);
        } catch {
            setIsSubmitting(false);
            addToast({ title: 'Failed to submit bug report', description: 'Please try again later.', variant: 'error' });
        }
    };

    const canSubmit = title.trim().length > 0 && description.trim().length > 0;

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                role="dialog" aria-modal="true"
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(460px, 95vw)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 16,
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                    animation: 'scaleIn 0.2s ease-out',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bug size={20} style={{ color: 'var(--accent-purple, #a78bfa)' }} />
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Report an Issue</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover-bg-tertiary"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ height: 1, background: 'var(--stroke)', margin: '0 24px' }} />

                {isSubmitted ? (
                    <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 16,
                            animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        }}>
                            <CheckCircle size={28} color="var(--success, #22c55e)" />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Thanks for the report!</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>We'll look into it.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                        {/* Category pills */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: 20,
                                        border: `1px solid ${category === cat.value ? 'var(--accent-purple, #a78bfa)' : 'var(--stroke)'}`,
                                        background: category === cat.value ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
                                        color: category === cat.value ? 'var(--accent-purple, #a78bfa)' : 'var(--text-secondary)',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                    }}
                                >
                                    <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Title */}
                        <input
                            type="text"
                            placeholder="Brief summary of the issue"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--stroke)',
                                padding: '11px 14px',
                                borderRadius: 10,
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                width: '100%',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent-purple, #a78bfa)'}
                            onBlur={e => e.target.style.borderColor = 'var(--stroke)'}
                        />

                        {/* Description */}
                        <textarea
                            placeholder="What happened? What did you expect?"
                            required
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--stroke)',
                                padding: '11px 14px',
                                borderRadius: 10,
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                transition: 'border-color 0.15s',
                                width: '100%',
                                boxSizing: 'border-box',
                                lineHeight: 1.5,
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent-purple, #a78bfa)'}
                            onBlur={e => e.target.style.borderColor = 'var(--stroke)'}
                        />

                        {/* Attachments */}
                        <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={handleFileChange} />

                        {screenshots.length === 0 ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragActive(false);
                                    const files = e.dataTransfer.files;
                                    if (!files) return;
                                    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
                                    setScreenshots(prev => [...prev, ...validFiles].slice(0, 5));
                                }}
                                style={{
                                    border: `1px dashed ${dragActive ? 'var(--accent-purple, #a78bfa)' : 'var(--stroke)'}`,
                                    borderRadius: 10,
                                    padding: '16px',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)',
                                    background: dragActive ? 'rgba(167, 139, 250, 0.05)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                }}
                            >
                                <ImagePlus size={16} />
                                <span style={{ fontSize: 13 }}>Add screenshot</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {screenshots.map((file, idx) => (
                                    <div key={idx} style={{
                                        position: 'relative',
                                        width: 56, height: 56,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        border: '1px solid var(--stroke)',
                                        flexShrink: 0,
                                    }}>
                                        <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button
                                            type="button"
                                            onClick={() => removeScreenshot(idx)}
                                            style={{
                                                position: 'absolute', top: 2, right: 2,
                                                background: 'rgba(0,0,0,0.7)',
                                                border: 'none', color: 'white',
                                                width: 16, height: 16, borderRadius: '50%',
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                padding: 0,
                                            }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                {screenshots.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            width: 56, height: 56,
                                            borderRadius: 8,
                                            border: '1px dashed var(--stroke)',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <ImagePlus size={16} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Footer row: meta info + submit */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
                                <Paperclip size={12} />
                                <span>Page URL and device info will be included</span>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || !canSubmit}
                                style={{
                                    padding: '8px 24px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: canSubmit ? 'var(--accent-purple, #a78bfa)' : 'var(--bg-tertiary)',
                                    color: canSubmit ? 'white' : 'var(--text-muted)',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: canSubmit ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                    opacity: isSubmitting ? 0.6 : 1,
                                }}
                            >
                                {isSubmitting ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default BugReportModal;
