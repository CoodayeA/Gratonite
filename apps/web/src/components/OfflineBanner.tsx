import { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';

/**
 * OfflineBanner — lightweight, dismissible browser-offline indicator.
 *
 * This is complementary to ConnectionBanner (which tracks socket reconnection
 * status). OfflineBanner reflects pure `navigator.onLine` state so users get
 * an immediate cue when their network drops, even before the socket layer
 * notices. It's dismissible per offline session — when the user comes back
 * online and goes offline again, the banner re-appears.
 */
const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' && navigator.onLine === false
    );
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            setDismissed(false);
        };
        const handleOnline = () => {
            setIsOffline(false);
            setDismissed(false);
        };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline || dismissed) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9998,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '8px 16px',
                paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle, var(--stroke))',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                animation: 'offlineBannerSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >
            <WifiOff size={14} aria-hidden="true" />
            <span>You're offline. Some features may not work.</span>
            <button
                aria-label="Dismiss offline notice"
                onClick={() => setDismissed(true)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, var(--text-primary))',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '4px',
                }}
            >
                <X size={14} />
            </button>
            <style>{`
                @keyframes offlineBannerSlideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default OfflineBanner;
