import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Hash, MessageSquare, Settings, Headphones, Users, Compass, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './ToastManager';

type TourStep = {
    title: string;
    description: string;
    icon: React.ReactNode;
    /** CSS selector to highlight. If element not found, falls back to centered modal. */
    target?: string;
    /** Preferred tooltip position relative to target */
    position?: 'top' | 'bottom' | 'left' | 'right';
};

const STEPS: TourStep[] = [
    {
        title: 'Welcome to Gratonite!',
        description: 'Let us show you around. This quick tour will help you get started.',
        icon: <Compass size={28} style={{ color: 'var(--accent-primary)' }} />,
    },
    {
        title: 'Server Sidebar',
        description: 'Your servers appear here. Click one to open it, or use the + button to create or join a server.',
        icon: <Hash size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="server-sidebar"],.server-list,nav[aria-label]',
        position: 'right',
    },
    {
        title: 'Channels',
        description: 'Each server has text and voice channels. Text channels are for messaging, voice channels for calls.',
        icon: <Hash size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="channel-list"],.channel-sidebar',
        position: 'right',
    },
    {
        title: 'Chat Area',
        description: 'Type messages here to chat with your community. You can share images, GIFs, and more.',
        icon: <MessageSquare size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="chat-input"],.chat-input',
        position: 'top',
    },
    {
        title: 'Voice Channels',
        description: 'Join a voice channel to talk with friends in real time. You can also share your screen.',
        icon: <Headphones size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="voice-channels"],.voice-channel',
        position: 'right',
    },
    {
        title: 'Friends & DMs',
        description: 'Click the chat icon to open Direct Messages and manage your friends list.',
        icon: <Users size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="dm-button"],.dm-tab',
        position: 'bottom',
    },
    {
        title: 'Settings',
        description: 'Customize your profile, themes, notifications, and more from the settings panel.',
        icon: <Settings size={28} style={{ color: 'var(--accent-primary)' }} />,
        target: '[data-tour="settings-button"],.user-settings-btn',
        position: 'top',
    },
    {
        title: "You're all set!",
        description: "Welcome aboard! Explore at your own pace. You've earned 100 bonus coins for completing the tour.",
        icon: <CheckCircle size={28} style={{ color: '#3ba55c' }} />,
    },
];

const STORAGE_KEY = 'gratonite_tour_complete';
const PADDING = 8;
const TOOLTIP_GAP = 12;

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();

    const current = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;

    // Find and measure the target element
    const measureTarget = useCallback(() => {
        if (!current.target) {
            setTargetRect(null);
            return;
        }
        // Try each selector separated by comma
        const selectors = current.target.split(',');
        for (const sel of selectors) {
            const el = document.querySelector(sel.trim());
            if (el) {
                const rect = el.getBoundingClientRect();
                setTargetRect({
                    top: rect.top - PADDING,
                    left: rect.left - PADDING,
                    width: rect.width + PADDING * 2,
                    height: rect.height + PADDING * 2,
                });
                return;
            }
        }
        setTargetRect(null);
    }, [current.target]);

    useEffect(() => {
        measureTarget();
        // Re-measure on resize/scroll
        window.addEventListener('resize', measureTarget);
        window.addEventListener('scroll', measureTarget, true);
        return () => {
            window.removeEventListener('resize', measureTarget);
            window.removeEventListener('scroll', measureTarget, true);
        };
    }, [measureTarget]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { handleSkip(); }
            else if (e.key === 'ArrowRight' || e.key === 'Enter') { handleNext(); }
            else if (e.key === 'ArrowLeft' && step > 0) { setStep(s => s - 1); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [step]);

    const handleNext = async () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            localStorage.setItem(STORAGE_KEY, '1');
            try { await api.post('/users/@me/onboarding-complete', {}); } catch { addToast({ title: 'Failed to complete tour', variant: 'error' }); }
            onClose();
        }
    };

    const handleSkip = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        onClose();
    };

    // Compute tooltip position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetRect) {
            // Centered modal
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const pos = current.position || 'bottom';
        const base: React.CSSProperties = { position: 'fixed' };

        switch (pos) {
            case 'right':
                base.top = targetRect.top;
                base.left = targetRect.left + targetRect.width + TOOLTIP_GAP;
                // Don't overflow right edge
                if (base.left as number > window.innerWidth - 340) {
                    base.left = targetRect.left - 320 - TOOLTIP_GAP;
                }
                break;
            case 'left':
                base.top = targetRect.top;
                base.left = targetRect.left - 320 - TOOLTIP_GAP;
                if ((base.left as number) < 0) {
                    base.left = targetRect.left + targetRect.width + TOOLTIP_GAP;
                }
                break;
            case 'top':
                base.bottom = window.innerHeight - targetRect.top + TOOLTIP_GAP;
                base.left = targetRect.left;
                break;
            case 'bottom':
            default:
                base.top = targetRect.top + targetRect.height + TOOLTIP_GAP;
                base.left = targetRect.left;
                break;
        }

        return base;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
            {/* SVG overlay with cutout */}
            <svg
                style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                onClick={(e) => {
                    // Click on backdrop (outside cutout) does nothing, but we need to stop propagation
                    e.stopPropagation();
                }}
            >
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left}
                                y={targetRect.top}
                                width={targetRect.width}
                                height={targetRect.height}
                                rx="8"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0" y="0" width="100%" height="100%"
                    fill="rgba(0,0,0,0.65)"
                    mask="url(#tour-mask)"
                    style={{ pointerEvents: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                />
            </svg>

            {/* Highlight border around target */}
            {targetRect && (
                <div style={{
                    position: 'fixed',
                    top: targetRect.top,
                    left: targetRect.left,
                    width: targetRect.width,
                    height: targetRect.height,
                    border: '2px solid var(--accent-primary)',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 4px rgba(82, 109, 245, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={{
                    ...getTooltipStyle(),
                    width: '320px',
                    maxWidth: 'calc(100vw - 32px)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-xl, 16px)',
                    padding: '24px',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    zIndex: 2001,
                    animation: 'fadeInSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleSkip}
                    style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '4px',
                    }}
                    aria-label="Skip tour"
                >
                    <X size={16} />
                </button>

                {/* Icon + Content */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                    <div style={{
                        padding: '10px', background: 'var(--bg-elevated)',
                        borderRadius: '12px', flexShrink: 0,
                    }}>
                        {current.icon}
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                            {current.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {current.description}
                        </p>
                    </div>
                </div>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', justifyContent: 'center' }}>
                    {STEPS.map((_, i) => (
                        <div key={i} style={{
                            width: i === step ? '18px' : '6px',
                            height: '6px',
                            borderRadius: '3px',
                            transition: 'all 0.3s',
                            background: i === step ? 'var(--accent-primary)' : i < step ? 'var(--accent-primary)' : 'var(--stroke)',
                            opacity: i < step ? 0.5 : 1,
                        }} />
                    ))}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={handleSkip}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
                            padding: '6px 12px',
                        }}
                    >
                        Skip tour
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isFirst && (
                            <button
                                onClick={() => setStep(s => s - 1)}
                                style={{
                                    padding: '8px 14px', background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)', border: '1px solid var(--stroke)',
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                            >
                                <ChevronLeft size={14} />
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            style={{
                                padding: '8px 16px', background: 'var(--accent-primary)',
                                color: 'white', border: 'none',
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                        >
                            {isLast ? 'Finish' : 'Next'}
                            {!isLast && <ChevronRight size={14} />}
                        </button>
                    </div>
                </div>

                {/* Step counter */}
                <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {step + 1} of {STEPS.length}
                </p>
            </div>
        </div>
    );
}

// Note: `useShouldShowTour` lives in ./useShouldShowTour.ts so it can
// be imported without pulling in this heavy component bundle.
export { useShouldShowTour } from './useShouldShowTour';
