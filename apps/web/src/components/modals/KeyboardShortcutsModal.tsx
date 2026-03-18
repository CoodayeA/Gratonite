import { useEffect, useState, useCallback, useRef } from 'react';
import { Keyboard, X, RotateCcw } from 'lucide-react';
import {
    DEFAULT_KEYBINDINGS,
    getUserOverrides,
    setCombo,
    resetCombo,
    resetAllCombos,
    findConflict,
    eventToCombo,
    formatCombo,
} from '../../utils/keybindings';

const KeyboardShortcutsModal = ({ onClose }: { onClose: () => void }) => {
    const [overrides, setOverrides] = useState<Record<string, string>>(getUserOverrides);
    const [rebindingId, setRebindingId] = useState<string | null>(null);
    const [conflict, setConflict] = useState<{ actionId: string; label: string } | null>(null);
    const rebindRef = useRef<string | null>(null);

    rebindRef.current = rebindingId;

    // Close on escape (only if not rebinding)
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (rebindRef.current) {
                e.preventDefault();
                e.stopPropagation();
                // Escape during rebinding cancels the rebind
                setRebindingId(null);
                setConflict(null);
                return;
            }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc, true);
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [onClose]);

    // Handle key capture for rebinding
    useEffect(() => {
        if (!rebindingId) return;

        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const combo = eventToCombo(e);
            if (!combo) return; // Only modifier pressed

            // Check for conflict
            const conflicting = findConflict(rebindingId, combo);
            if (conflicting) {
                setConflict({ actionId: conflicting.id, label: conflicting.label });
            } else {
                setConflict(null);
            }

            // Save the binding
            setCombo(rebindingId, combo);
            setOverrides(getUserOverrides());
            setRebindingId(null);
            // Clear conflict after brief delay so user can see it
            setTimeout(() => setConflict(null), 2000);
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [rebindingId]);

    const handleReset = useCallback((actionId: string) => {
        resetCombo(actionId);
        setOverrides(getUserOverrides());
    }, []);

    const handleResetAll = useCallback(() => {
        resetAllCombos();
        setOverrides({});
    }, []);

    const getEffectiveCombo = (actionId: string, defaultCombo: string): string => {
        return overrides[actionId] || defaultCombo;
    };

    // Group by category
    const categories = Array.from(new Set(DEFAULT_KEYBINDINGS.map(b => b.category)));

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                role="dialog" aria-modal="true"
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(650px, 95vw)',
                    borderRadius: '16px',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    animation: 'scaleIn 0.2s ease-out',
                    maxHeight: '90vh',
                }}
            >
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--accent-primary)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Keyboard Shortcuts</h2>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click a shortcut to rebind it</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {Object.keys(overrides).length > 0 && (
                            <button onClick={handleResetAll} style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RotateCcw size={12} /> Reset All
                            </button>
                        )}
                        <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Conflict warning */}
                {conflict && (
                    <div style={{ padding: '8px 24px', background: 'rgba(250, 166, 26, 0.1)', borderBottom: '1px solid rgba(250, 166, 26, 0.3)', fontSize: '12px', color: '#faa61a' }}>
                        Warning: This key combo was already bound to "{conflict.label}"
                    </div>
                )}

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-primary)', maxHeight: '60vh', overflowY: 'auto' }}>
                    {categories.map(cat => {
                        const bindings = DEFAULT_KEYBINDINGS.filter(b => b.category === cat);
                        return (
                            <div key={cat}>
                                <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>{cat}</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {bindings.map(binding => {
                                        const effective = getEffectiveCombo(binding.id, binding.defaultCombo);
                                        const isCustom = !!overrides[binding.id];
                                        const isRebinding = rebindingId === binding.id;
                                        const displayKeys = formatCombo(effective);

                                        return (
                                            <div key={binding.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: isRebinding ? 'rgba(88, 101, 242, 0.1)' : 'transparent', border: isRebinding ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{binding.label}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {isCustom && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReset(binding.id); }}
                                                            title="Reset to default"
                                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                        >
                                                            <RotateCcw size={12} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setRebindingId(isRebinding ? null : binding.id)}
                                                        style={{ display: 'flex', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                    >
                                                        {isRebinding ? (
                                                            <div style={{
                                                                padding: '4px 12px', borderRadius: '6px',
                                                                background: 'var(--accent-primary)',
                                                                color: 'white', fontSize: '12px', fontWeight: 600,
                                                                animation: 'pulse 1.5s ease-in-out infinite',
                                                            }}>
                                                                Press a key combo...
                                                            </div>
                                                        ) : (
                                                            displayKeys.map((k, i) => (
                                                                <div key={i} style={{
                                                                    background: isCustom ? 'rgba(88, 101, 242, 0.2)' : 'var(--bg-elevated)',
                                                                    border: `1px solid ${isCustom ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                    borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 600,
                                                                    color: isCustom ? 'var(--accent-primary)' : 'white',
                                                                    minWidth: '24px', textAlign: 'center',
                                                                    boxShadow: '0 2px 0 var(--stroke)',
                                                                }}>
                                                                    {k}
                                                                </div>
                                                            ))
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
