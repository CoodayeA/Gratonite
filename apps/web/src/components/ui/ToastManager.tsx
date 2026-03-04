import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, Trophy, X } from 'lucide-react';
import { playSound } from '../../utils/SoundManager';

export type ToastVariant = 'success' | 'error' | 'info' | 'achievement';

export type Toast = {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
    duration?: number;
};

type ToastContextType = {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { ...toast, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    zIndex: 99998,
                    perspective: '1000px',
                    pointerEvents: 'none', // Letting clicks pass through the container
                }}
            >
                {toasts.map((toast, index) => {
                    const offset = toasts.length - 1 - index;
                    // Provide a stacking effect via CSS transforms
                    const scale = Math.max(0, 1 - offset * 0.05);
                    const translateY = offset * -10;

                    return (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            onRemove={() => removeToast(toast.id)}
                            style={{
                                transform: `translateY(${translateY}px) scale(${scale})`,
                                opacity: scale > 0.8 ? 1 : 0,
                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                        />
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove, style }: { toast: Toast, onRemove: () => void, style: React.CSSProperties }) => {
    const [mounted, setMounted] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);

    const handleRemove = useCallback(() => {
        if (exiting) return;
        setExiting(true);
        setTimeout(() => {
            onRemove();
        }, 300);
    }, [exiting, onRemove]);

    useEffect(() => {
        // Trigger entrance animation after mount
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setMounted(true);
                setProgress(0);
            });
        });
    }, []);

    useEffect(() => {
        if (toast.variant === 'achievement') {
            // Routed through SoundManager so autoplay policy is handled
            // consistently (no AudioContext creation before user gesture).
            playSound('achievement');
        }

        const timer = setTimeout(() => {
            handleRemove();
        }, toast.duration || (toast.variant === 'achievement' ? 6000 : 4000));
        return () => clearTimeout(timer);
    }, [toast.variant, toast.duration, handleRemove]);

    let Icon = Info;
    let iconColor = 'var(--accent-blue)';
    let bgGradient = 'var(--bg-elevated)';
    let glow = 'none';

    switch (toast.variant) {
        case 'success':
            Icon = CheckCircle;
            iconColor = 'var(--success)';
            bgGradient = 'linear-gradient(135deg, rgba(16,185,129,0.1), var(--bg-elevated))';
            break;
        case 'error':
            Icon = AlertCircle;
            iconColor = 'var(--error)';
            bgGradient = 'linear-gradient(135deg, rgba(239,68,68,0.1), var(--bg-elevated))';
            glow = '0 0 16px rgba(239,68,68,0.3)';
            break;
        case 'achievement':
            Icon = Trophy;
            iconColor = '#fff';
            bgGradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            glow = '0 0 32px rgba(16, 185, 129, 0.6)';
            break;
        case 'info':
        default:
            Icon = Info;
            iconColor = 'var(--accent-blue)';
            break;
    }

    const isAchievement = toast.variant === 'achievement';

    const toastDuration = toast.duration || (isAchievement ? 6000 : 4000);

    return (
        <div
            style={{
                background: bgGradient,
                border: isAchievement ? '2px solid rgba(255,255,255,0.4)' : '1px solid var(--stroke)',
                borderRadius: isAchievement ? '32px' : 'var(--radius-md)',
                padding: isAchievement ? '12px 24px' : '16px',
                minWidth: '320px',
                maxWidth: '400px',
                display: 'flex',
                alignItems: isAchievement ? 'center' : 'flex-start',
                gap: '16px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), ${glow}`,
                pointerEvents: 'auto', // So user can interact with the toast
                backdropFilter: 'blur(16px)',
                cursor: 'pointer',
                color: isAchievement ? 'white' : 'var(--text-primary)',
                position: 'relative',
                overflow: 'hidden',
                ...style,
                transform: exiting
                    ? `${style.transform || ''} translateX(120%)`.trim()
                    : mounted
                        ? `${style.transform || ''} translateX(0)`.trim()
                        : `${style.transform || ''} translateX(120%)`.trim(),
                opacity: exiting ? 0 : (style.opacity ?? 1),
                transition: exiting
                    ? 'all 0.3s cubic-bezier(0.4, 0, 1, 1)'
                    : 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            className="hover-lift"
            onClick={handleRemove}
        >
            <div style={{ color: iconColor, flexShrink: 0, marginTop: isAchievement ? '0' : '2px', background: isAchievement ? 'rgba(0,0,0,0.2)' : 'transparent', padding: isAchievement ? '8px' : '0', borderRadius: '50%', display: 'flex' }}>
                <Icon size={isAchievement ? 28 : 24} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontWeight: isAchievement ? 700 : 600, color: 'inherit', fontSize: isAchievement ? '16px' : '15px', fontFamily: isAchievement ? 'var(--font-display)' : 'inherit' }}>
                    {toast.title}
                </div>
                {toast.description && (
                    <div style={{ color: isAchievement ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
                        {toast.description}
                    </div>
                )}
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: isAchievement ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = isAchievement ? 'white' : 'var(--text-primary)'}
                onMouseOut={(e) => e.currentTarget.style.color = isAchievement ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'}
            >
                <X size={16} />
            </button>
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    background: iconColor,
                    borderRadius: 'inherit',
                    width: progress + '%',
                    transition: `width ${toastDuration}ms linear`,
                    transformOrigin: 'left',
                }} />
            </div>
        </div>
    );
};
