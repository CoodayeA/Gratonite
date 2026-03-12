import { useState, useEffect } from 'react';
import { X, Bug, Upload, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

const BugReportModal = ({ onClose }: { onClose: () => void }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.bugReports.create({
                title,
                summary: description,
                pageUrl: window.location.href,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                userAgent: navigator.userAgent,
                clientTimestamp: new Date().toISOString(),
            });
            setIsSubmitting(false);
            setIsSubmitted(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch {
            setIsSubmitting(false);
            addToast({ title: 'Failed to submit bug report', description: 'Please try again later.', variant: 'error' });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(480px, 95vw)',
                    borderRadius: '16px',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    animation: 'scaleIn 0.2s ease-out',
                    maxHeight: '90vh'
                }}
            >
                <div style={{ padding: '24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--error)', opacity: 0.9, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Bug size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Report an Issue</h2>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Help us improve Gratonite</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ background: 'var(--bg-primary)', position: 'relative' }}>
                    {isSubmitted ? (
                        <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white' }}>
                            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '16px', animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Got it, thanks!</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your report has been sent to our engineers.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    placeholder="What's going wrong?"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    autoFocus
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '10px 14px', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="Steps to reproduce, expected behavior, actual behavior..."
                                    required
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '10px 14px', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Attachments</label>
                                <div style={{ border: '1px dashed var(--stroke)', borderRadius: '8px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--stroke)'}>
                                    <Upload size={20} />
                                    <div style={{ fontSize: '13px' }}>Click or drag a screenshot here</div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="auth-button"
                                disabled={isSubmitting}
                                style={{ margin: '8px 0 0 0', opacity: isSubmitting ? 0.7 : 1, width: '100%', display: 'flex', justifyContent: 'center' }}
                            >
                                {isSubmitting ? 'Sending...' : 'Submit Report'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BugReportModal;
