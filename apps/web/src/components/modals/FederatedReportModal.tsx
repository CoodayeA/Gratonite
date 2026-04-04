import { useState } from 'react';
import { X, Globe, Flag, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface FederatedReportModalProps {
    /** Pre-filled originating instance domain (e.g. "example.social"). */
    instanceDomain?: string;
    /** Optional federation address of the reported user. */
    federationAddress?: string;
    /** Optional user ID being reported. */
    reportedUserId?: string;
    onClose: () => void;
}

type Category = 'spam' | 'harassment' | 'csam' | 'other';

const CATEGORIES: { value: Category; label: string; desc: string }[] = [
    { value: 'spam',        label: 'Spam',              desc: 'Unsolicited or repetitive content' },
    { value: 'harassment',  label: 'Harassment',        desc: 'Targeted abuse, threats, or hate speech' },
    { value: 'csam',        label: 'Child Safety',      desc: 'Content that endangers minors (CSAM)' },
    { value: 'other',       label: 'Other',             desc: 'Other policy violations' },
];

export function FederatedReportModal({
    instanceDomain: initialDomain = '',
    federationAddress,
    reportedUserId,
    onClose,
}: FederatedReportModalProps) {
    const { addToast } = useToast();
    const [instanceDomain, setInstanceDomain] = useState(initialDomain);
    const [category, setCategory] = useState<Category>('other');
    const [description, setDescription] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const selectedCategory = CATEGORIES.find(c => c.value === category)!;

    const handleSubmit = async () => {
        if (!description.trim()) return;
        setSubmitting(true);
        try {
            await api.instanceReports.submit({
                instanceDomain: instanceDomain.trim() || 'unknown',
                category,
                description: description.trim(),
                reportedUserId,
            });
            setSubmitted(true);
            const domain = instanceDomain.trim() || 'the remote instance';
            addToast({
                title: 'Report submitted',
                description: `Report sent to ${domain} and local admins.`,
                variant: 'success',
            });
        } catch {
            addToast({ title: 'Failed to submit report', variant: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Report federated content"
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(480px, 95vw)',
                    background: 'var(--bg-elevated)',
                    border: 'var(--border-structural, 3px solid #000)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '10px',
                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Flag size={18} style={{ color: '#ef4444' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Report Federated Content</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                Help keep Gratonite safe across instances
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '20px 24px 24px' }}>
                    {submitted ? (
                        /* Success state */
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Report Submitted</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Your report has been forwarded to{' '}
                                <strong>{instanceDomain.trim() || 'the remote instance'}</strong> and local admins.
                                Thank you for helping keep the federation safe.
                            </p>
                            <button
                                onClick={onClose}
                                className="auth-button"
                                style={{ marginTop: '20px', padding: '10px 32px', display: 'inline-flex' }}
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Originating instance */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                    display: 'block', fontSize: '12px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                    color: 'var(--text-muted)', marginBottom: '6px',
                                }}>
                                    Originating Instance
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Globe
                                        size={14}
                                        style={{
                                            position: 'absolute', left: 12, top: '50%',
                                            transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={instanceDomain}
                                        onChange={e => setInstanceDomain(e.target.value)}
                                        placeholder="e.g. example.social"
                                        style={{
                                            width: '100%', padding: '10px 12px 10px 32px',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
                                            outline: 'none', boxSizing: 'border-box',
                                        }}
                                    />
                                </div>
                                {federationAddress && (
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Reporting content from <strong>{federationAddress}</strong>
                                    </p>
                                )}
                            </div>

                            {/* Category */}
                            <div style={{ marginBottom: '16px', position: 'relative' }}>
                                <label style={{
                                    display: 'block', fontSize: '12px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                    color: 'var(--text-muted)', marginBottom: '6px',
                                }}>
                                    Category
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryDropdown(p => !p)}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
                                        cursor: 'pointer', textAlign: 'left', display: 'flex',
                                        alignItems: 'center', justifyContent: 'space-between',
                                    }}
                                >
                                    <span>{selectedCategory.label}</span>
                                    <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                                </button>
                                {showCategoryDropdown && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', marginTop: '4px', overflow: 'hidden',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    }}>
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.value}
                                                type="button"
                                                onClick={() => { setCategory(cat.value); setShowCategoryDropdown(false); }}
                                                style={{
                                                    width: '100%', padding: '10px 14px', border: 'none',
                                                    background: category === cat.value ? 'var(--active-overlay)' : 'transparent',
                                                    cursor: 'pointer', textAlign: 'left', display: 'flex',
                                                    flexDirection: 'column', gap: '2px',
                                                }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {cat.label}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block', fontSize: '12px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                    color: 'var(--text-muted)', marginBottom: '6px',
                                }}>
                                    Description <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Describe the issue in detail. Include what happened and any relevant context."
                                    rows={4}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
                                        outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                        boxSizing: 'border-box', lineHeight: 1.5,
                                    }}
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {description.length}/1000 characters
                                </p>
                            </div>

                            {/* CSAM warning */}
                            {category === 'csam' && (
                                <div style={{
                                    padding: '10px 14px', marginBottom: '16px',
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '8px', fontSize: '12px', color: '#fca5a5', lineHeight: 1.6,
                                }}>
                                    <strong>⚠ Child safety reports</strong> are treated with the highest priority.
                                    Your report will be escalated immediately to local admins and the originating instance.
                                    Do not share or reproduce the content.
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        flex: 1, padding: '11px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)',
                                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !description.trim()}
                                    style={{
                                        flex: 1, padding: '11px',
                                        background: submitting || !description.trim() ? 'var(--bg-tertiary)' : '#ef4444',
                                        border: 'none', borderRadius: '8px',
                                        color: submitting || !description.trim() ? 'var(--text-muted)' : 'white',
                                        fontSize: '14px', fontWeight: 600,
                                        cursor: submitting || !description.trim() ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    }}
                                >
                                    <Flag size={14} />
                                    {submitting ? 'Submitting…' : 'Submit Report'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
