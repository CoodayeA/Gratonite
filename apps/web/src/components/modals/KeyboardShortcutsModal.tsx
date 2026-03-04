import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const shortcuts = [
    {
        category: 'Navigation', items: [
            { label: 'Global Search', keys: ['⌘', 'K'] },
            { label: 'Next Channel', keys: ['⌥', '↓'] },
            { label: 'Previous Channel', keys: ['⌥', '↑'] },
            { label: 'Open Keyboard Shortcuts', keys: ['⌘', '/'] }
        ]
    },
    {
        category: 'Messaging', items: [
            { label: 'Send Message', keys: ['Enter'] },
            { label: 'New Line', keys: ['⇧', 'Enter'] },
            { label: 'Edit Last Message', keys: ['↑'] },
            { label: 'Autocomplete Navigate', keys: ['↑', '↓'] },
            { label: 'Autocomplete Select', keys: ['Tab'] }
        ]
    },
    {
        category: 'Voice & Call', items: [
            { label: 'Toggle Mute', keys: ['⌘', '⇧', 'M'] },
            { label: 'Toggle Deafen', keys: ['⌘', '⇧', 'D'] },
            { label: 'Push to Talk', keys: ['Hold Space'] }
        ]
    }
];

const KeyboardShortcutsModal = ({ onClose }: { onClose: () => void }) => {

    // Close on escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '600px',
                    borderRadius: '16px',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    animation: 'scaleIn 0.2s ease-out'
                }}
            >
                <div style={{ padding: '24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--accent-primary)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Keyboard Shortcuts</h2>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Navigate Gratonite faster</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', background: 'var(--bg-primary)', maxHeight: '60vh', overflowY: 'auto' }}>
                    {shortcuts.map(category => (
                        <div key={category.category} style={{ gridColumn: category.category === 'Navigation' ? '1 / -1' : 'auto' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>{category.category}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {category.items.map(item => (
                                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.label}</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {item.keys.map(k => (
                                                <div key={k} style={{
                                                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                                    borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 600,
                                                    color: 'white', minWidth: '24px', textAlign: 'center',
                                                    boxShadow: '0 2px 0 var(--stroke)'
                                                }}>
                                                    {k}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
