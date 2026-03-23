import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, Trophy, X, Undo2 } from 'lucide-react';
import { playSound } from '../../utils/SoundManager';
import gsap from 'gsap';

export type ToastVariant = 'success' | 'error' | 'info' | 'achievement' | 'undo';

export type Toast = {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
    duration?: number;
    onUndo?: () => void;
    onExpire?: () => void;
    count?: number;
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

const MAX_VISIBLE = 3;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        setToasts(prev => {
            // Dedup: if same variant+title is already showing, increment count
            const existingIdx = prev.findIndex(
                t => t.variant === toast.variant && t.title === toast.title && t.variant !== 'undo'
            );
            if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    count: (updated[existingIdx].count || 1) + 1,
                };
                return updated;
            }
            const id = Math.random().toString(36).substring(2, 9);
            return [...prev, { ...toast, id, count: 1 }];
        });
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Only show max visible; the rest queue behind
    const visible = toasts.slice(-MAX_VISIBLE);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div
                className="toast-container"
                role="status"
                aria-live="polite"
                aria-atomic="false"
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    zIndex: 2000,
                    perspective: '1000px',
                    pointerEvents: 'none',
                }}
            >
                {visible.map((toast, index) => {
                    const offset = visible.length - 1 - index;
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
    const toastRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(100);
    const [isHovered, setIsHovered] = useState(false);
    const undoneRef = useRef(false);
    const hoveredRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef(Date.now());
    const remainingRef = useRef(0);
    const toastDuration = toast.duration || (toast.variant === 'achievement' ? 6000 : toast.variant === 'undo' ? 5000 : 4000);
    const remainingForTransitionRef = useRef(toastDuration);

    const handleRemove = useCallback(() => {
        if (exiting) return;
        setExiting(true);
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (toastRef.current && !prefersReduced) {
            gsap.to(toastRef.current, {
                x: 120, opacity: 0, duration: 0.3, ease: 'power2.in',
                onComplete: onRemove,
            });
        } else {
            setTimeout(onRemove, 300);
        }
    }, [exiting, onRemove]);

    const handleUndo = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (undoneRef.current) return;
        undoneRef.current = true;
        toast.onUndo?.();
        handleRemove();
    }, [toast, handleRemove]);

    // Start or restart timer
    const startTimer = useCallback((duration: number) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        remainingRef.current = duration;
        startRef.current = Date.now();
        timerRef.current = setTimeout(() => {
            if (!undoneRef.current && toast.variant === 'undo') {
                toast.onExpire?.();
            }
            handleRemove();
        }, duration);
    }, [handleRemove, toast]);

    // Pause timer on hover
    const handleMouseEnter = useCallback(() => {
        hoveredRef.current = true;
        setIsHovered(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }, []);

    // Resume timer on mouse leave
    const handleMouseLeave = useCallback(() => {
        hoveredRef.current = false;
        setIsHovered(false);
        if (remainingRef.current > 0) {
            const remaining = remainingRef.current;
            startTimer(remaining);
            // Resume progress bar from current position using remaining time for transition
            const fraction = remaining / toastDuration;
            setProgress(fraction * 100);
            // Store remaining for transition duration
            remainingForTransitionRef.current = remaining;
            requestAnimationFrame(() => { requestAnimationFrame(() => { setProgress(0); }); });
        }
    }, [startTimer, toastDuration]);

    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (toastRef.current && !prefersReduced) {
            gsap.fromTo(toastRef.current,
                { x: 120, opacity: 0 },
                { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' }
            );
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setMounted(true);
                setProgress(0);
            });
        });
    }, []);

    useEffect(() => {
        if (toast.variant === 'achievement') {
            playSound('achievement');
        }
        startTimer(toastDuration);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast.variant, toastDuration, startTimer]);

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
        case 'undo':
            Icon = Undo2;
            iconColor = 'var(--warning, #f59e0b)';
            bgGradient = 'linear-gradient(135deg, rgba(245,158,11,0.12), var(--bg-elevated))';
            glow = '0 0 16px rgba(245,158,11,0.2)';
            break;
        case 'info':
        default:
            Icon = Info;
            iconColor = 'var(--accent-blue)';
            break;
    }

    const isAchievement = toast.variant === 'achievement';
    const isUndo = toast.variant === 'undo';
    const count = toast.count || 1;

    return (
        <div
            ref={toastRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
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
                pointerEvents: 'auto',
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
            role="alert"
            aria-label={`${toast.variant}: ${toast.title}${count > 1 ? ` (${count})` : ''}${toast.description ? '. ' + toast.description : ''}`}
            onClick={isUndo ? undefined : handleRemove}
        >
            <div style={{ color: iconColor, flexShrink: 0, marginTop: isAchievement ? '0' : '2px', background: isAchievement ? 'rgba(0,0,0,0.2)' : 'transparent', padding: isAchievement ? '8px' : '0', borderRadius: '50%', display: 'flex' }}>
                <Icon size={isAchievement ? 28 : 24} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: isAchievement ? 700 : 600, color: 'inherit', fontSize: isAchievement ? '16px' : '15px', fontFamily: isAchievement ? 'var(--font-display)' : 'inherit' }}>
                        {toast.title}
                    </span>
                    {count > 1 && (
                        <span style={{
                            background: iconColor,
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            borderRadius: '10px',
                            padding: '1px 7px',
                            minWidth: '20px',
                            textAlign: 'center',
                            lineHeight: '16px',
                            flexShrink: 0,
                        }}>
                            {count}
                        </span>
                    )}
                    {isUndo && toast.onUndo && (
                        <button
                            onClick={handleUndo}
                            className="toast-undo-btn"
                        >
                            Undo
                        </button>
                    )}
                </div>
                {toast.description && (
                    <div style={{ color: isAchievement ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4' }}>
                        {toast.description}
                    </div>
                )}
            </div>
            <button
                aria-label="Dismiss notification"
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                className="toast-dismiss-btn"
                style={{
                    color: isAchievement ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                }}
            >
                <X size={16} />
            </button>
            {/* Auto-dismiss progress bar */}
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
                    transition: isHovered ? 'none' : `width ${remainingForTransitionRef.current}ms linear`,
                    transformOrigin: 'left',
                }} />
            </div>
        </div>
    );
};
