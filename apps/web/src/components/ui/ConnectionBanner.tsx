import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { onSocketDisconnect, onSocketReconnect } from '../../lib/socket';

type BannerState = 'hidden' | 'disconnected' | 'connected';

const ConnectionBanner = () => {
    const [state, setState] = useState<BannerState>('hidden');
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasDisconnectedRef = useRef(false);

    useEffect(() => {
        const unsubDisconnect = onSocketDisconnect(() => {
            hasDisconnectedRef.current = true;
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            setState('disconnected');
        });

        const unsubReconnect = onSocketReconnect(() => {
            // Only show "Connected" banner if we previously disconnected
            if (!hasDisconnectedRef.current) return;
            hasDisconnectedRef.current = false;
            setState('connected');
            hideTimerRef.current = setTimeout(() => {
                setState('hidden');
                hideTimerRef.current = null;
            }, 3000);
        });

        return () => {
            unsubDisconnect();
            unsubReconnect();
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    if (state === 'hidden') return null;

    const isDisconnected = state === 'disconnected';

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: isDisconnected ? 'var(--bg-primary)' : 'var(--bg-primary)',
            background: isDisconnected
                ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                : 'linear-gradient(90deg, #22c55e, #10b981)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'connectionBannerSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'background 0.3s ease',
        }}>
            {isDisconnected ? (
                <>
                    <WifiOff size={14} />
                    <span>Reconnecting...</span>
                    <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(0,0,0,0.2)',
                        borderTopColor: 'var(--bg-primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                </>
            ) : (
                <>
                    <Wifi size={14} />
                    <span>Connected</span>
                </>
            )}
            <style>{`
                @keyframes connectionBannerSlideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ConnectionBanner;
