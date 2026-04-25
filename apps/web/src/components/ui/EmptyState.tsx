import { Sparkles, Ghost, ShoppingBag, AlertTriangle, Users, Search, MessageSquare, Bell, Hash } from 'lucide-react';
import { TiltCard, RippleWrapper } from './Physics';

type EmptyStateProps = {
    type: 'chat' | 'inventory' | '404' | 'friends' | 'search' | 'dm' | 'notifications' | 'server';
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
};

export const EmptyState = ({ type, title, description, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: EmptyStateProps) => {
    // Generative abstract composition using pure CSS depending on type
    return (
        <div
            className="gt-empty-state"
            data-ui-empty-state={type}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '64px 24px', textAlign: 'center', animation: 'fadeInSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        >

            <TiltCard>
                <div className="empty-state-illustration gt-empty-state__illustration" style={{
                    width: '160px', height: '160px', position: 'relative', marginBottom: '32px',
                    perspective: '1000px'
                }}>
                    {type === 'chat' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-primary)', opacity: 0.1, borderRadius: '50%', filter: 'blur(20px)', animation: 'pulse 4s infinite alternate' }} />
                            <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', border: '2px solid var(--stroke-light)', borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', animation: 'spin 12s linear infinite' }} />
                            <div style={{ position: 'absolute', top: '20%', left: '20%', width: '60%', height: '60%', border: '2px dashed var(--accent-primary)', borderRadius: '50%', animation: 'spin 8s linear infinite reverse', opacity: 0.5 }} />
                            <div style={{
                                position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))',
                                borderRadius: '24px', transform: 'rotate(-5deg) translateZ(20px)',
                                border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
                            }}>
                                <Ghost size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', animation: 'float 3s ease-in-out infinite' }}>
                                <Sparkles size={24} color="var(--accent-primary)" />
                            </div>
                        </>
                    )}

                    {type === 'inventory' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-purple)', opacity: 0.1, filter: 'blur(30px)', animation: 'pulse 3s infinite alternate' }} />
                            {/* Floating crates/boxes */}
                            <div style={{
                                position: 'absolute', top: '10%', left: '15%', width: '40px', height: '40px',
                                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px',
                                transform: 'rotate(-15deg)', animation: 'float 4s ease-in-out infinite'
                            }} />
                            <div style={{
                                position: 'absolute', bottom: '15%', right: '10%', width: '50px', height: '50px',
                                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px',
                                transform: 'rotate(20deg)', animation: 'float 5s ease-in-out infinite reverse'
                            }} />

                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateZ(30px)',
                                width: '80px', height: '80px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-primary))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--accent-purple)', boxShadow: '0 0 24px rgba(139, 92, 246, 0.4)'
                            }}>
                                <ShoppingBag size={32} color="white" />
                            </div>
                        </>
                    )}

                    {type === '404' && (
                        <>
                            {/* Glitchy 404 block */}
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--error)', opacity: 0.15, filter: 'blur(40px)', animation: 'pulse 2s infinite alternate' }} />

                            {[...Array(3)].map((_, i) => (
                                <div key={i} style={{
                                    position: 'absolute', top: '20%', left: '10%', width: '80%', height: '60%',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--error)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '48px', fontWeight: 900, fontFamily: 'var(--font-display)',
                                    color: i === 0 ? 'var(--error)' : i === 1 ? 'var(--accent-bluelight)' : 'white',
                                    mixBlendMode: i === 2 ? 'normal' : 'screen',
                                    transform: `translate(${i * 4 - 4}px, ${i * -2 + 2}px)`,
                                    opacity: i === 2 ? 1 : 0.7,
                                    animation: i === 2 ? 'none' : `glitch-anim ${1 + i * 0.5}s infinite linear alternate-reverse`
                                }}>
                                    404
                                </div>
                            ))}
                        </>
                    )}

                    {type === 'friends' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-primary)', opacity: 0.08, borderRadius: '50%', filter: 'blur(25px)', animation: 'pulse 5s infinite alternate' }} />
                            <div style={{ position: 'absolute', top: '15%', left: '20%', width: '45px', height: '45px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 4s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={20} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 5s ease-in-out infinite reverse', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={16} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                            </div>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))', borderRadius: '24px', border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <Users size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        </>
                    )}

                    {type === 'search' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-blue, #3b82f6)', opacity: 0.08, borderRadius: '50%', filter: 'blur(25px)', animation: 'pulse 4s infinite alternate' }} />
                            <div style={{ position: 'absolute', top: '20%', left: '20%', width: '60%', height: '60%', border: '2px dashed var(--stroke)', borderRadius: '50%', animation: 'spin 10s linear infinite', opacity: 0.3 }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))', borderRadius: '24px', border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <Search size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        </>
                    )}

                    {type === 'dm' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-primary)', opacity: 0.08, borderRadius: '50%', filter: 'blur(25px)', animation: 'pulse 4s infinite alternate' }} />
                            <div style={{ position: 'absolute', top: '10%', right: '10%', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 3.5s ease-in-out infinite', transform: 'rotate(15deg)' }} />
                            <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '25px', height: '25px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 4.5s ease-in-out infinite reverse', transform: 'rotate(-10deg)' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))', borderRadius: '24px', border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <MessageSquare size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        </>
                    )}

                    {type === 'notifications' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--warning, #faa61a)', opacity: 0.08, borderRadius: '50%', filter: 'blur(25px)', animation: 'pulse 3s infinite alternate' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))', borderRadius: '24px', border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <Bell size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <div style={{ position: 'absolute', top: '-8px', right: '-8px', animation: 'float 3s ease-in-out infinite' }}>
                                <Sparkles size={20} color="var(--warning, #faa61a)" />
                            </div>
                        </>
                    )}

                    {type === 'server' && (
                        <>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-primary)', opacity: 0.08, borderRadius: '50%', filter: 'blur(25px)', animation: 'pulse 4s infinite alternate' }} />
                            <div style={{ position: 'absolute', top: '15%', left: '10%', width: '35px', height: '35px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 4s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Hash size={16} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: '30px', height: '30px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', animation: 'float 5s ease-in-out infinite reverse', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Hash size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                            </div>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))', borderRadius: '24px', border: '1px solid var(--stroke)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <Hash size={48} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        </>
                    )}
                </div>
            </TiltCard>

            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'white', marginBottom: '8px' }}>
                {title}
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6', marginBottom: '32px' }}>
                {description}
            </p>

            {((actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction)) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {actionLabel && onAction && (
                        <RippleWrapper>
                            <button
                                className="gt-empty-state__action gt-empty-state__action--primary"
                                onClick={onAction}
                                style={{
                                    background: type === '404' ? 'var(--error)' : 'var(--accent-primary)',
                                    color: type === '404' ? 'white' : 'var(--bg-primary)',
                                    border: 'none', padding: '12px 32px', borderRadius: 'var(--radius-md)',
                                    fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: `0 4px 14px ${type === '404' ? 'rgba(237, 66, 69, 0.4)' : 'var(--accent-primary-alpha)'}`
                                }}
                            >
                                {type === 'chat' && <Sparkles size={18} />}
                                {type === 'inventory' && <ShoppingBag size={18} />}
                                {type === '404' && <AlertTriangle size={18} />}
                                {actionLabel}
                            </button>
                        </RippleWrapper>
                    )}
                    {secondaryActionLabel && onSecondaryAction && (
                        <RippleWrapper>
                            <button
                                className="gt-empty-state__action gt-empty-state__action--secondary"
                                onClick={onSecondaryAction}
                                style={{
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--stroke)',
                                    padding: '12px 24px',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {secondaryActionLabel}
                            </button>
                        </RippleWrapper>
                    )}
                </div>
            )}
        </div>
    );
};
