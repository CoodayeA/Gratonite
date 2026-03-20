import React, { useEffect, useState } from 'react';
import { ExternalLink, Shield } from 'lucide-react';

const STORAGE_KEY = 'gratonite:skip-external-link-warning';

interface ExternalLinkModalProps {
    url: string;
    onClose: () => void;
}

export default function ExternalLinkModal({ url, onClose }: ExternalLinkModalProps) {
    const [skipWarning, setSkipWarning] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleContinue = () => {
        if (skipWarning) {
            try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{
                width: 420, maxWidth: '95vw', padding: 24,
                background: 'var(--bg-elevated)', borderRadius: 16,
                border: '1px solid var(--stroke)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Shield size={22} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        You are about to leave Gratonite
                    </h3>
                </div>

                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                    This link will take you to an external website. Make sure you trust the destination before continuing.
                </p>

                <div style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                    border: '1px solid var(--stroke)', wordBreak: 'break-all',
                }}>
                    <ExternalLink size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{url}</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                    <input
                        type="checkbox"
                        checked={skipWarning}
                        onChange={e => setSkipWarning(e.target.checked)}
                        style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    Don't warn me again
                </label>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: '1px solid var(--stroke)',
                            background: 'transparent', color: 'var(--text-primary)', fontSize: 14,
                            fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Go Back
                    </button>
                    <button
                        onClick={handleContinue}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: 'var(--accent-primary)', color: '#000', fontSize: 14,
                            fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
