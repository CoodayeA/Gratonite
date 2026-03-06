import { useState, useEffect } from 'react';
import { User, Smile, Check, Paintbrush, LogOut } from 'lucide-react';
import { useTheme, AppTheme } from '../ui/ThemeProvider';

export type PresenceType = 'online' | 'idle' | 'dnd' | 'invisible';

interface PresenceMenuProps {
    isOpen: boolean;
    onClose: () => void;
    currentPresence: PresenceType;
    onChangePresence: (p: PresenceType) => void;
    customStatus: string | null;
    onChangeStatus: (s: string | null) => void;
    onOpenProfile: () => void;
    onOpenSettings: () => void;
    onLogout: () => void;
    userName?: string;
    avatarUrl?: string | null;
}

export const PRESENCE_COLORS = {
    online: '#10b981',
    idle: '#f59e0b',
    dnd: '#ef4444',
    invisible: '#6b7280'
};

const PresenceMenu = ({ isOpen, onClose, currentPresence, onChangePresence, customStatus, onChangeStatus, onOpenProfile, onLogout, userName, avatarUrl }: PresenceMenuProps) => {
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [statusInput, setStatusInput] = useState(customStatus || '');
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setMounted(true);
            });
        });
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-presence-menu]') && !target.closest('[data-presence-toggle]')) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSetCustomStatus = () => {
        onChangeStatus(statusInput.trim() ? statusInput : null);
        setIsEditingStatus(false);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSetCustomStatus();
        if (e.key === 'Escape') {
            setStatusInput(customStatus || '');
            setIsEditingStatus(false);
        }
    };

    return (
        <div data-presence-menu style={{
            position: 'absolute',
            bottom: '72px',
            left: '16px',
            width: '280px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 100,
            overflow: 'hidden',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
            transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
            <div style={{ padding: '24px 16px 16px', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(135deg, rgba(82,109,245,0.2), transparent)' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', position: 'relative', boxShadow: '0 0 0 4px var(--bg-elevated)', overflow: 'visible' }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} draggable={false} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '20px' }}>
                                {userName ? userName[0].toUpperCase() : '?'}
                            </div>
                        )}
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: '18px', height: '18px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: PRESENCE_COLORS[currentPresence] }}></div>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{userName || 'User'}</div>
                        {customStatus && !isEditingStatus && (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Smile size={12} /> {customStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Custom Status Input */}
                {isEditingStatus ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set a custom status</div>
                        <input
                            autoFocus
                            type="text"
                            className="chat-input"
                            style={{ padding: '8px', fontSize: '13px', background: 'var(--bg-primary)' }}
                            value={statusInput}
                            onChange={e => setStatusInput(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder="What's happening?"
                            maxLength={50}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setIsEditingStatus(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSetCustomStatus} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setIsEditingStatus(true)} className="menu-item" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                        <Smile size={16} />
                        <span style={{ fontSize: '14px' }}>{customStatus ? 'Edit text status' : 'Set custom status'}</span>
                    </button>
                )}

                <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }}></div>

                {/* Presence Toggles */}
                {(['online', 'idle', 'dnd', 'invisible'] as PresenceType[]).map(p => (
                    <button
                        key={p}
                        onClick={() => { onChangePresence(p); onClose(); }}
                        className="menu-item"
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
                        onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: PRESENCE_COLORS[p] }}></div>
                            <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>{p === 'dnd' ? 'Do Not Disturb' : p}</span>
                        </div>
                        {currentPresence === p && <Check size={14} color="var(--text-muted)" />}
                    </button>
                ))}

                <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }}></div>

                <button onClick={() => { onClose(); onOpenProfile(); }} className="menu-item" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <User size={16} />
                    <span style={{ fontSize: '14px' }}>Profile Settings</span>
                </button>

                <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }}></div>

                <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>App Theme</div>

                {(['neobrutalism', 'glass', 'memphis', 'synthwave', 'y2k'] as AppTheme[]).map(t => (
                    <button
                        key={t}
                        onClick={() => { setTheme(t); }}
                        className="menu-item"
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
                        onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Paintbrush size={14} />
                            <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>{t}</span>
                        </div>
                        {theme === t && <Check size={14} color="var(--text-muted)" />}
                    </button>
                ))}

                <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }}></div>

                <button onClick={() => { onClose(); onLogout(); }} className="menu-item" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', borderRadius: 'var(--radius-sm)', color: '#ef4444' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <LogOut size={16} />
                    <span style={{ fontSize: '14px' }}>Log Out</span>
                </button>
            </div>

            <style>
                {`
                    .menu-item:hover {
                        background: rgba(255, 255, 255, 0.05) !important;
                    }
                `}
            </style>
        </div>
    );
};

export default PresenceMenu;
